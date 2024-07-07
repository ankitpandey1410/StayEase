const mongoose = require('mongoose')
const {Schema} = mongoose;

const userSchema = new Schema({
  name: {
    type: 'String',
  },
  email: {
    type: 'String',
    unique: true,
  },
  password: {
    type: 'String',
  }
}, {timestamps: true})

const UserModel = mongoose.model('User' , userSchema);
module.exports = UserModel

