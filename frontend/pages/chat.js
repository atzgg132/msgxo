import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { io } from 'socket.io-client';
import dayjs from 'dayjs';
import {
  Search, Menu, Phone, Video, MoreVertical, Paperclip, Smile, Send, 
  ChevronLeft, Star, Archive, Bell, MessageSquare, Settings, 
  Sun, Moon
} from 'lucide-react';

export default function ChatPage() {
  const router = useRouter();
  const [socket, setSocket] = useState(null);

  // Auth/user state
  const [myId, setMyId] = useState('');
  const [myUsername, setMyUsername] = useState('');

  // Chat list and active chat
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);

  // Input for sending new messages
  const [inputMsg, setInputMsg] = useState('');

  // New chat modal
  const [showModal, setShowModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState('');
  const [newDirectUser, setNewDirectUser] = useState('');

  // Additional UI state
  const [darkMode, setDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pinnedChats, setPinnedChats] = useState(new Set());
  const [archivedChats, setArchivedChats] = useState(new Set());

  const chatContainerRef = useRef(null);
  const tokenRef = useRef('');

  // On mount: check auth, connect socket, fetch chats
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) {
      router.push('/login');
      return;
    }
    tokenRef.current = token;
    const userObj = JSON.parse(userStr);
    setMyId(userObj.id);
    setMyUsername(userObj.username);

    const newSocket = io('http://localhost:5000', {
      query: { userId: userObj.id }
    });
    setSocket(newSocket);

    fetchChats(token);

    return () => {
      newSocket.disconnect();
    };
  }, [router]);

  // Fetch chats
  async function fetchChats(token) {
    try {
      const res = await axios.get('http://localhost:5000/api/chat/recent', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch chats');
    }
  }

  // Listen for chatListUpdated to refetch
  useEffect(() => {
    if (!socket) return;
    const handleChatListUpdate = () => {
      fetchChats(tokenRef.current);
    };
    socket.on('chatListUpdated', handleChatListUpdate);
    return () => {
      socket.off('chatListUpdated', handleChatListUpdate);
    };
  }, [socket]);

  // Select a chat, join its room, fetch messages
  async function handleSelectChat(chat) {
    setActiveChat(chat);
    setMessages([]);

    if (socket) {
      if (chat.type === 'group') {
        socket.emit('joinRoom', chat._id);
      } else {
        const roomId = makeDMRoom(myUsername, chat.name);
        socket.emit('joinDirect', roomId);
      }
    }

    try {
      let msgs = [];
      if (chat.type === 'group') {
        const res = await axios.get(
          `http://localhost:5000/api/chat/group/${chat._id}/messages`,
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
        msgs = res.data;
      } else {
        const res = await axios.get(
          `http://localhost:5000/api/chat/dm/user/${chat.name}`,
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
        msgs = res.data;
      }
      setMessages(msgs);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch chat messages');
    }
  }

  // Send a message (group or direct)
  async function handleSendMessage() {
    if (!activeChat || !inputMsg) return;
    try {
      let res;
      if (activeChat.type === 'group') {
        res = await axios.post('http://localhost:5000/api/chat/message',
          { content: inputMsg, groupId: activeChat._id },
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
      } else {
        res = await axios.post('http://localhost:5000/api/chat/dm',
          { content: inputMsg, recipientUsername: activeChat.name },
          { headers: { Authorization: `Bearer ${tokenRef.current}` } }
        );
      }
      // const newMsg = res.data.message;
      // setMessages(prev => [...prev, newMsg]);
      setInputMsg('');
    } catch (err) {
      console.error(err);
      alert('Failed to send message');
    }
  }

  // Handle incoming real-time messages
  useEffect(() => {
    if (!socket) return;

    function handleGroupMsg(data) {
      if (!activeChat || activeChat.type !== 'group') return;
      if (activeChat._id !== data.groupId) return; 
      deduplicateAndAppend(data);
    }

    function handleDMMsg(data) {
      if (!activeChat || activeChat.type !== 'direct') return;
      const expected = makeDMRoom(myUsername, activeChat.name);
      if (data.roomId !== expected) return;
      deduplicateAndAppend(data);
    }

    socket.on('groupMsg', handleGroupMsg);
    socket.on('dmMsg', handleDMMsg);

    return () => {
      socket.off('groupMsg', handleGroupMsg);
      socket.off('dmMsg', handleDMMsg);
    };
  }, [socket, activeChat, myUsername]);

  // Deduplicate new messages by _id
  function deduplicateAndAppend(incomingMsg) {
    setMessages(prev => {
      const exists = prev.find(m => String(m._id) === String(incomingMsg._id));
      if (exists) return prev;
      return [...prev, incomingMsg];
    });
  }

  // Auto-scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Create Group
  async function handleCreateGroup() {
    try {
      const mems = newGroupMembers.split(',').map(m => m.trim()).filter(Boolean);
      await axios.post('http://localhost:5000/api/chat/group',
        { name: newGroupName, members: mems },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setNewGroupName('');
      setNewGroupMembers('');
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create group');
    }
  }

  // Start Direct
  async function handleStartDirect() {
    try {
      await axios.post('http://localhost:5000/api/chat/dm',
        { content: '...', recipientUsername: newDirectUser },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setNewDirectUser('');
      setShowModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to start direct chat');
    }
  }

  // Delete Chat
  async function handleDeleteChat() {
    if (!activeChat) return;
    try {
      if (activeChat.type === 'group') {
        await axios.delete(`http://localhost:5000/api/chat/group/${activeChat._id}`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` }
        });
      } else {
        await axios.delete(`http://localhost:5000/api/chat/dm/user/${activeChat.name}`, {
          headers: { Authorization: `Bearer ${tokenRef.current}` }
        });
      }
      setChats(prev => prev.filter(c => c._id !== activeChat._id));
      setActiveChat(null);
      setMessages([]);
    } catch (err) {
      console.error(err);
      alert('Failed to delete chat');
    }
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  // Helpers
  function makeDMRoom(a, b) {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
    return `dm_${x}_${y}`;
  }
  function isMyMessage(senderId) {
    return senderId === myId;
  }
  function formatTime(d) {
    return dayjs(d).format('HH:mm');
  }

  // Chat filtering
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedChats = [...filteredChats].sort((a, b) => {
    const aPinned = pinnedChats.has(a._id);
    const bPinned = pinnedChats.has(b._id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  function togglePinChat(chatId) {
    setPinnedChats(prev => {
      const newPinned = new Set(prev);
      if (newPinned.has(chatId)) newPinned.delete(chatId);
      else newPinned.add(chatId);
      return newPinned;
    });
  }
  function toggleArchiveChat(chatId) {
    setArchivedChats(prev => {
      const newArchived = new Set(prev);
      if (newArchived.has(chatId)) newArchived.delete(chatId);
      else newArchived.add(chatId);
      return newArchived;
    });
  }

  const filteredMessages = messages.filter(msg =>
    msg.content.toLowerCase().includes(messageSearch.toLowerCase())
  );

  return (
    <div className={`h-screen flex ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>
      {showSidebar && (
        <div className={`w-96 flex flex-col ${darkMode ? 'bg-gray-800' : 'bg-white'} border-r border-gray-700`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Menu className="w-6 h-6 cursor-pointer" />
              <h1 className="text-xl font-bold">Chats</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-gray-700">
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Settings className="w-6 h-6 cursor-pointer" />
              <button onClick={handleLogout} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600">
                Logout
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full p-2 pl-10 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} outline-none`}
              />
              <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sortedChats.map(c => (
              <div
                key={c._id}
                onClick={() => handleSelectChat(c)}
                className={`px-4 py-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700
                  ${activeChat?._id === c._id ? 'bg-gray-700' : ''}
                  ${pinnedChats.has(c._id) ? 'border-l-4 border-blue-500' : ''}
                  ${archivedChats.has(c._id) ? 'opacity-50' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold">{c.name}</div>
                  <div className="flex gap-2">
                    <Star
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinChat(c._id);
                      }}
                      className={`w-4 h-4 ${pinnedChats.has(c._id) ? 'fill-yellow-500' : ''}`}
                    />
                    <Archive
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleArchiveChat(c._id);
                      }}
                      className={`w-4 h-4 ${archivedChats.has(c._id) ? 'fill-gray-500' : ''}`}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {c.type === 'group' ? 'Group Chat' : 'Direct'}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-700">
            <button
              onClick={() => setShowModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              New Chat
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        {activeChat && (
          <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'bg-gray-800' : 'bg-white'} border-gray-700`}>
            <div className="flex items-center gap-4">
              {!showSidebar && (
                <ChevronLeft
                  className="w-6 h-6 cursor-pointer"
                  onClick={() => setShowSidebar(true)}
                />
              )}
              <h2 className="text-lg font-bold">
                {activeChat.type === 'group' ? 'Group: ' : ''}{activeChat.name}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  className={`p-1 pl-8 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} outline-none`}
                />
                <Search className="absolute left-2 top-2 w-4 h-4 text-gray-400" />
              </div>
              <Phone className="w-5 h-5 cursor-pointer" />
              <Video className="w-5 h-5 cursor-pointer" />
              <button
                onClick={handleDeleteChat}
                className="bg-red-600 px-2 py-1 rounded text-sm hover:bg-red-700"
              >
                Delete Chat
              </button>
            </div>
          </div>
        )}

        {!activeChat && (
          <div className={`p-4 border-b ${darkMode ? 'bg-gray-800' : 'bg-white'} border-gray-700`}>
            <h2 className="text-lg font-bold">Select a chat</h2>
          </div>
        )}

        <div
          ref={chatContainerRef}
          className={`flex-1 overflow-y-auto p-4 ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}
        >
          {activeChat && filteredMessages.map(msg => {
            const mine = isMyMessage(msg.sender?._id);
            return (
              <div
                key={String(msg._id)}
                className={`flex mb-2 ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xl px-4 py-2 rounded-lg ${
                  mine 
                    ? 'bg-blue-600 text-white' 
                    : darkMode 
                      ? 'bg-gray-700 text-white' 
                      : 'bg-white text-gray-800'
                }`}>
                  <div className="text-sm font-semibold mb-1">
                    {mine ? '(You)' : msg.sender?.username}
                  </div>
                  <div className="break-words">{msg.content}</div>
                  <div className="text-right text-xs mt-1 opacity-70">
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activeChat && (
          <div className={`p-4 border-t flex items-center gap-3 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-gray-700`}>
            <button className="p-2 rounded-full hover:bg-gray-700">
              <Paperclip className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <input
                className={`w-full p-3 pr-12 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} outline-none`}
                placeholder="Type a message..."
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
              />
              <button
                className="absolute right-3 top-3"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleSendMessage}
              className="p-3 rounded-full bg-blue-600 hover:bg-blue-700"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

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
