const firebaseService = require('../service/firebase-service')
const moment = require('moment')
const request = require('request-promise')
const path = require('path')
const fs = require('fs')
const os = require('os')

class submit {
  constructor () {
    this.firebase = new firebaseService()
  }

  async decodeBase64(messageId, config) {
    let bufferArr = []
    let buffer = await request.get({
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      },
      url: `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      encoding: null
    })
    bufferArr.push(buffer)
    return bufferArr
  }

  fileExtension(message) {
    var _file = ''
    if (message.type === 'video') {
      _file = 'mp4'
    } else if (message.type === 'image') {
      _file = 'jpg'
    } else if (message.type === 'audio') {
      _file = 'acc'
    }
    return _file
  }

  async uploadStorage(messageId, bufferArr, _file) {
    for (let i = 0; i < bufferArr.length; i++) {
      const buffer = bufferArr[i];
      const tempLocalFile = path.join(os.tmpdir(), `fileName.${_file}`)
      fs.writeFileSync(tempLocalFile, buffer)
      /* eslint-disable no-await-in-loop */
      await this.firebase.bucketUpload(tempLocalFile, messageId, _file)
      fs.unlinkSync(tempLocalFile)
  }
  return `https://firebasestorage.googleapis.com/v0/b/chatbot-it-support.appspot.com/o/${messageId}.${_file}?alt=media`
}

  saveToFirestore(answer) {
    let randomNumber = (Math.random() * 1000).toFixed(0)
    let jobId = `${moment().format('YYYY-MM-DD')}#${randomNumber}`
    let payload = {
      createdTimestamp: moment().format('x'),
      message: answer,
      status: '',
      jobId: jobId
    }
    this.firebase.create(payload)
  }
}

module.exports = submit