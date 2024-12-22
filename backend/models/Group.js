const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: ObjectId, ref: 'User' }],
  messages: [{ type: ObjectId, ref: 'Message' }]
}, { timestamps: true });

module.exports = mongoose.model('Group', groupSchema);
