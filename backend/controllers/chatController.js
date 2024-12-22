// backend/controllers/chatController.js

const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');

// A helper to create a stable DM room name from two usernames
function makeDMRoom(a, b) {
  // For consistency, use lowercase + sort
  const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
  return `dm_${x}_${y}`;
}

// If you want to broadcast to the personal "user_{id}" rooms for chat list updates
function broadcastChatListUpdate(io, userIds) {
  userIds.forEach(uid => {
    const room = `user_${uid}`;
    io.to(room).emit('chatListUpdated');
  });
}

/**
 * GET /api/chat/recent
 * Returns all group chats (where user is a member)
 * plus direct chats with any user they've exchanged messages with
 */
exports.getRecentChats = async (req, res) => {
  try {
    const userId = req.userId;

    // 1) Groups
    const groups = await Group.find({ members: userId })
      .select('_id name')
      .lean();
    const groupChats = groups.map(g => ({
      _id: g._id.toString(),
      name: g.name,
      type: 'group'
    }));

    // 2) Direct
    const dmMessages = await Message.find({
      group: null,
      $or: [{ sender: userId }, { recipient: userId }]
    })
      .populate('sender recipient', 'username')
      .lean();

    const otherUsersSet = new Set();
    dmMessages.forEach(m => {
      if(String(m.sender._id) === userId) {
        otherUsersSet.add(String(m.recipient._id));
      } else {
        otherUsersSet.add(String(m.sender._id));
      }
    });

    let directChats = [];
    if(otherUsersSet.size > 0) {
      const otherUsers = await User.find({ _id: { $in: [...otherUsersSet] } })
        .select('_id username')
        .lean();
      directChats = otherUsers.map(u => ({
        _id: u._id.toString(),
        name: u.username,
        type: 'direct'
      }));
    }

    const allChats = [...groupChats, ...directChats];
    return res.status(200).json(allChats);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to fetch recent chats' });
  }
};

/**
 * POST /api/chat/group
 * Body: { name, members: [username1, username2, ...] }
 * Also auto-add the creator to the members array if not present
 */
exports.createGroup = async (req, res) => {
  try {
    const io = req.app.get('socketio'); // so we can broadcast
    const userId = req.userId;
    const { name, members } = req.body;

    if(!name || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ msg: 'Group name + members[] required' });
    }

    // find user docs for these usernames
    const userDocs = await User.find({ username: { $in: members } });
    const foundIds = userDocs.map(u => String(u._id));

    // ensure the creator is in the group
    if(!foundIds.includes(userId)) {
      foundIds.push(userId);
    }

    const group = await Group.create({ name, members: foundIds });

    // If you want to also broadcast for chat list updates:
    broadcastChatListUpdate(io, foundIds);

    return res.status(201).json({ msg: 'Group created', group });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * GET /api/chat/group/:groupId/messages
 * Retrieve all messages for a group, sorted by createdAt
 */
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const msgs = await Message.find({ group: groupId })
      .populate('sender', 'username')
      .sort({ createdAt: 1 });
    return res.status(200).json(msgs);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * POST /api/chat/message (send group message)
 * Body: { content, groupId }
 * Broadcasts 'groupMsg' event with the full message doc
 */
exports.sendMessage = async (req, res) => {
  try {
    const io = req.app.get('socketio');
    const userId = req.userId;
    const { content, groupId } = req.body;

    if(!content || !groupId) {
      return res.status(400).json({ msg: 'content + groupId required' });
    }

    const group = await Group.findById(groupId);
    if(!group) {
      return res.status(404).json({ msg: 'Group not found' });
    }
    if(!group.members.map(id => String(id)).includes(userId)) {
      return res.status(403).json({ msg: 'You are not in this group' });
    }

    const newMsg = await Message.create({
      sender: userId,
      content,
      group: groupId,
      recipient: null
    });
    group.messages.push(newMsg._id);
    await group.save();

    const populated = await Message.findById(newMsg._id)
      .populate('sender', 'username');

    // Broadcast to the group's socket room
    io.to(groupId).emit('groupMsg', {
      _id: populated._id,
      content: populated.content,
      sender: {
        _id: populated.sender._id,
        username: populated.sender.username
      },
      createdAt: populated.createdAt
      // you could also include groupId if needed
    });

    return res.status(201).json({ msg: 'Message sent', message: populated });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * POST /api/chat/dm (send direct message)
 * Body: { content, recipientUsername }
 * Broadcasts 'dmMsg' event with the full message doc
 */
exports.sendDirectMessage = async (req, res) => {
  try {
    const io = req.app.get('socketio');
    const userId = req.userId;
    const { content, recipientUsername } = req.body;

    if(!content || !recipientUsername) {
      return res.status(400).json({ msg: 'content + recipientUsername required' });
    }

    const recipient = await User.findOne({ username: recipientUsername });
    if(!recipient) {
      return res.status(404).json({ msg: 'Recipient not found' });
    }

    const newMsg = await Message.create({
      sender: userId,
      content,
      recipient: recipient._id,
      group: null
    });
    const populated = await Message.findById(newMsg._id)
      .populate('sender', 'username');

    // build the DM room name
    const senderUser = await User.findById(userId).select('username');
    const roomId = makeDMRoom(senderUser.username, recipientUsername);

    io.to(roomId).emit('dmMsg', {
      _id: populated._id,
      content: populated.content,
      sender: {
        _id: populated.sender._id,
        username: populated.sender.username
      },
      createdAt: populated.createdAt,
      roomId
    });

    // Optionally broadcast chatListUpdated to both parties
    broadcastChatListUpdate(io, [userId, recipient._id.toString()]);

    return res.status(201).json({ msg: 'DM sent', message: populated });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * GET /api/chat/dm/user/:username
 * Retrieve all direct messages between the current user and :username
 */
exports.getDirectMessagesByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const userId = req.userId;

    const other = await User.findOne({ username });
    if(!other) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const msgs = await Message.find({
      group: null,
      $or: [
        { sender: userId, recipient: other._id },
        { sender: other._id, recipient: userId }
      ]
    })
      .populate('sender', 'username')
      .sort({ createdAt: 1 });

    return res.status(200).json(msgs);
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * DELETE /api/chat/group/:groupId
 * Removes the group doc + all its messages, then broadcasts chatListUpdated
 */
exports.deleteGroup = async (req, res) => {
  try {
    const io = req.app.get('socketio');
    const userId = req.userId;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if(!group) return res.status(404).json({ msg: 'Group not found' });

    if(!group.members.map(id => String(id)).includes(userId)) {
      return res.status(403).json({ msg: 'You are not a member of this group' });
    }

    // remove all messages in this group
    await Message.deleteMany({ group: groupId });
    // gather the members
    const memberIds = group.members.map(id => String(id));
    await group.remove();

    broadcastChatListUpdate(io, memberIds);

    return res.status(200).json({ msg: 'Group deleted' });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

/**
 * DELETE /api/chat/dm/user/:username
 * Removes all direct messages between current user and that user
 * Then broadcasts chatListUpdated to both
 */
exports.deleteDirectChat = async (req, res) => {
  try {
    const io = req.app.get('socketio');
    const userId = req.userId;
    const { username } = req.params;

    const other = await User.findOne({ username });
    if(!other) return res.status(404).json({ msg: 'User not found' });

    await Message.deleteMany({
      group: null,
      $or: [
        { sender: userId, recipient: other._id },
        { sender: other._id, recipient: userId }
      ]
    });

    broadcastChatListUpdate(io, [userId, other._id.toString()]);

    return res.status(200).json({ msg: 'Direct chat deleted' });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};
