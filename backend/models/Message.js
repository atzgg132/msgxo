const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const messageSchema = new mongoose.Schema({
  sender: { type: ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  group: { type: ObjectId, ref: 'Group', default: null },
  recipient: { type: ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
