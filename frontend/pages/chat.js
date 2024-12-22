import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { io } from 'socket.io-client';
import dayjs from 'dayjs';

export default function ChatPage() {
  const router = useRouter();
  const [socket, setSocket] = useState(null);

  // user
  const [myId, setMyId] = useState('');
  const [myUsername, setMyUsername] = useState('');

  // chat list, active chat, messages
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);

  // For new messages
  const [inputMsg, setInputMsg] = useState('');

  // For new chat modal
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState('');
  const [newDirectUser, setNewDirectUser] = useState('');

  const chatContainerRef = useRef(null);
  const tokenRef = useRef('');

  // ------------------------------------------------
  // On mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if(!token || !userStr) {
      router.push('/login');
      return;
    }

    tokenRef.current = token;
    const userObj = JSON.parse(userStr);
    setMyId(userObj.id);
    setMyUsername(userObj.username);

    // connect socket with userId in query
    const newSocket = io('http://localhost:5000', {
      query: { userId: userObj.id }
    });
    setSocket(newSocket);

    // fetch chats
    fetchChats(token);

    return () => {
      newSocket.disconnect();
    };
  }, [router]);

  async function fetchChats(token) {
    try {
      const res = await axios.get('http://localhost:5000/api/chat/recent', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(res.data);
    } catch(err) {
      console.error(err);
      alert('Failed to fetch chats');
    }
  }

  // -----------
  // Listen for chatListUpdated if you use that approach (optional)
  useEffect(() => {
    if(!socket) return;
    const handleChatListUpdate = () => {
      console.log('chatListUpdated => re-fetch chats');
      fetchChats(tokenRef.current);
    };
    socket.on('chatListUpdated', handleChatListUpdate);
    return () => {
      socket.off('chatListUpdated', handleChatListUpdate);
    };
  }, [socket]);

  // -----------
  // select chat
  async function handleSelectChat(chat) {
    setActiveChat(chat);
    setMessages([]);

    if(socket) {
      if(chat.type === 'group') {
        socket.emit('joinRoom', chat._id);
      } else {
        const roomId = makeDMRoom(myUsername, chat.name);
        socket.emit('joinDirect', roomId);
      }
    }

    // fetch messages
    try {
      let msgs = [];
      if(chat.type === 'group') {
        const res = await axios.get(`http://localhost:5000/api/chat/group/${chat._id}/messages`,
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
        msgs = res.data;
      } else {
        const res = await axios.get(`http://localhost:5000/api/chat/dm/user/${chat.name}`,
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
        msgs = res.data;
      }
      setMessages(msgs);
    } catch(err) {
      console.error(err);
      alert('Failed to fetch chat messages');
    }
  }

  // -----------
  // send message
  async function handleSendMessage() {
    if(!activeChat || !inputMsg) return;
    try {
      let res;
      if(activeChat.type === 'group') {
        res = await axios.post('http://localhost:5000/api/chat/message',
          {
            groupId: activeChat._id,
            content: inputMsg
          },
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
      } else {
        res = await axios.post('http://localhost:5000/api/chat/dm',
          {
            content: inputMsg,
            recipientUsername: activeChat.name
          },
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
      }
      const newMsg = res.data.message;
      // local append
      setMessages(prev => [...prev, newMsg]);
      setInputMsg('');
    } catch(err) {
      console.error(err);
      alert('Failed to send message');
    }
  }

  // -----------
  // Socket events: groupMsg, dmMsg
  useEffect(() => {
    if(!socket) return;

    function handleGroupMsg(msgData) {
      // msgData = { _id, content, sender, createdAt, ... }
      if(!activeChat || activeChat.type !== 'group') return;
      if(activeChat._id !== msgData.sender?.group) {
        // if you store the group ID in msgData, compare it
        // but from the code above, we just have groupId in the event, or none
        // We'll assume the server used: io.to(groupId).emit('groupMsg', <the doc>).
        // So we just trust we are in that group
      }
      deduplicateAndAppend(msgData);
    }

    function handleDMMsg(msgData) {
      // msgData = { _id, content, sender, createdAt, roomId }
      if(!activeChat || activeChat.type !== 'direct') return;
      const expected = makeDMRoom(myUsername, activeChat.name);
      if(msgData.roomId !== expected) return;
      deduplicateAndAppend(msgData);
    }

    socket.on('groupMsg', handleGroupMsg);
    socket.on('dmMsg', handleDMMsg);

    return () => {
      socket.off('groupMsg', handleGroupMsg);
      socket.off('dmMsg', handleDMMsg);
    };
  }, [socket, activeChat, myUsername]);

  // -----------
  // deduplicate by _id
  function deduplicateAndAppend(incomingMsg) {
    // If we already have a message with _id == incomingMsg._id, skip
    setMessages(prev => {
      const exists = prev.find(m => String(m._id) === String(incomingMsg._id));
      if(exists) return prev; // no change
      return [...prev, incomingMsg];
    });
  }

  // -----------
  // auto-scroll
  useEffect(() => {
    if(chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // -----------
  // create group
  async function handleCreateGroup() {
    try {
      const mems = newGroupMembers.split(',').map(m=>m.trim()).filter(Boolean);
      await axios.post('http://localhost:5000/api/chat/group',
        { name: newGroupName, members: mems },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setNewGroupName('');
      setNewGroupMembers('');
      setShowModal(false);
      // server should broadcast 'chatListUpdated' => fetch again
    } catch(err) {
      console.error(err);
      alert('Failed to create group');
    }
  }

  // -----------
  // start direct
  async function handleStartDirect() {
    try {
      await axios.post('http://localhost:5000/api/chat/dm',
        { content: '...', recipientUsername: newDirectUser },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setNewDirectUser('');
      setShowModal(false);
      // same: server triggers 'chatListUpdated'
    } catch(err) {
      console.error(err);
      alert('Failed to start direct');
    }
  }

  // -----------
  // delete chat
  async function handleDeleteChat() {
    if(!activeChat) return;
    try {
      if(activeChat.type === 'group') {
        await axios.delete(`http://localhost:5000/api/chat/group/${activeChat._id}`, 
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
      } else {
        await axios.delete(`http://localhost:5000/api/chat/dm/user/${activeChat.name}`,
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
      }
      setChats(prev => prev.filter(c => c._id !== activeChat._id));
      setActiveChat(null);
      setMessages([]);
    } catch(err) {
      console.error(err);
      alert('Failed to delete chat');
    }
  }

  // -----------
  // logout
  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  // -----------
  // helpers
  function makeDMRoom(a, b) {
    return ['dm', a.toLowerCase(), b.toLowerCase()].sort().join('_');
  }
  function isMyMessage(senderId) {
    return senderId === myId;
  }
  function formatTime(d) {
    return dayjs(d).format('HH:mm');
  }

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      {/* LEFT SIDEBAR */}
      <div className="w-1/4 flex flex-col bg-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">Chat</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-semibold">Chats</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-sm"
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.map(c => (
            <div
              key={c._id}
              onClick={() => handleSelectChat(c)}
              className={`px-4 py-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700 ${
                activeChat?._id === c._id ? 'bg-gray-700' : ''
              }`}
            >
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-gray-300">
                {c.type === 'group' ? 'Group Chat' : 'Direct'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className="flex-1 flex flex-col">
        {/* HEADER */}
        <div className="p-4 border-b bg-gray-800 flex items-center justify-between">
          {activeChat ? (
            <>
              <h2 className="text-lg font-bold">
                {activeChat.type === 'group' ? 'Group:' : 'Direct:'} {activeChat.name}
              </h2>
              <button
                onClick={handleDeleteChat}
                className="bg-red-600 px-2 py-1 rounded text-sm hover:bg-red-700"
              >
                Delete Chat
              </button>
            </>
          ) : (
            <h2 className="text-lg font-bold">Select a chat</h2>
          )}
        </div>

        {/* MESSAGES */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 bg-gray-200 text-black"
        >
          {activeChat && messages.map(msg => {
            const mine = isMyMessage(msg.sender?._id);
            return (
              <div
                key={String(msg._id)}
                className={`flex mb-2 ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs px-3 py-2 rounded-lg ${mine ? 'bg-blue-600 text-white' : 'bg-gray-400 text-black'}`}>
                  <div className="text-sm font-semibold mb-1">
                    {mine ? '(You)' : msg.sender?.username}
                  </div>
                  <div>{msg.content}</div>
                  <div className="text-right text-xs mt-1">
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* INPUT */}
        {activeChat && (
          <div className="p-4 border-t bg-gray-800 flex">
            <input
              className="border p-2 flex-1 mr-2 text-black"
              placeholder="Type a message..."
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
            />
            <button
              onClick={handleSendMessage}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* NEW CHAT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white w-96 rounded-lg p-6 text-black">
            <h2 className="text-xl font-bold mb-4">Create / Start New Chat</h2>

            <div className="mb-6">
              <h3 className="font-semibold mb-2">New Group</h3>
              <input
                className="border p-2 w-full mb-2"
                placeholder="Group Name"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
              <input
                className="border p-2 w-full mb-2"
                placeholder="Member Usernames (comma separated)"
                value={newGroupMembers}
                onChange={e => setNewGroupMembers(e.target.value)}
              />
              <button
                onClick={handleCreateGroup}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Create Group
              </button>
            </div>

            <hr className="my-4" />

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Start Direct</h3>
              <input
                className="border p-2 w-full mb-2"
                placeholder="Username"
                value={newDirectUser}
                onChange={e => setNewDirectUser(e.target.value)}
              />
              <button
                onClick={handleStartDirect}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Start Direct Chat
              </button>
            </div>

            <div className="text-right">
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
