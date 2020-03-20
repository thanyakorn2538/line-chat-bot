const functions = require('firebase-functions');
const express = require('express')
const app = express()
const line = require('@line/bot-sdk')
const firebaseService = require('./service/firebase-service')
const submitProvider = require('./controller/submit')
const appendProvider = require('./controller/append')

const firebase = new firebaseService()
const submit = new submitProvider()
const append = new appendProvider()
const config = {
  channelAccessToken: 'nCmRcgR2JrELs12rskiWB3X4feG6fEwe5OvZkIDICgHQzu+pM9I4yG9iVpbzW2qLerhHKg5931Lvq7hy8ZHR8rr+47omQsUZVp/zDCwJ20ZYxgE0aJMN3wBDaZw8Jyx8Ocsf0ZWYITbC7s8Mr9Y9aQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eac5b8a6040ad91451ee24fbc261d7d9'
}
var answerArry = []
var appendBool = false
var clearTime = null
const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  for (let index = 0; index < req.body.events.length; index++) {
    const event = req.body.events[index];
    const { message, replyToken } = event
    if (clearTime !== null) {
      clearTimeout(clearTime)
      clearTime = null
    }
    switch (message.text) {
      case 'submit': {
        submitJob(answerArry, replyToken)
        clearTimeout(clearTime)
        break;
      }
      case 'append':
        client.replyMessage(replyToken, { type: 'text', text: 'ขอรหัสงาน' })
        appendBool = true
        clearTimeout(clearTime)
        break;
      case 'working': {
        /* eslint-disable no-await-in-loop */
        let currentUser = await fetchCurrentEmployee()
        client.replyMessage(replyToken, { type: 'text', text: currentUser.displayName})
        answerArry = []
        break;
      }
      default: {
        if (appendBool) {
          appendJob(answerArry, message)
          answerArry = []
        }
        clearTime = setTimeout(() => {
          submitJob(answerArry)
        }, 60 * 1000)
        answerArry.push(message)
      }
    }
  }
  res.send("OK")
})

// SUBMIT
async function submitJob (answerArry) { 
  let data = await processConvertMessages(answerArry)
  submit.saveToFirestore(data)
  let employee = await fetchCurrentEmployee()
  await pushLineMessageApi(employee.uidLine)
  answerArry = []
  clearTimeout(clearTime)
}
// SUBMIT



// APPEND
async function appendJob(answerArry, message) {
  let payload = await processConvertMessages(answerArry)
  let docId = await append.fetchDocId(message)
  append.updateToFirebase(docId, payload)
  let employee = await fetchCurrentEmployee()
  pushLineMessageApi(employee.uidLine)
  answerArry = []
  appendBool = false
  clearTimeout(clearTime)
}
// APPEND


async function processConvertMessages(answerArry) {
  let messages = []
  for (let index = 0; index < answerArry.length; index++) {
    const message = answerArry[index];
    if (message.type === 'text') {
      let msg = {
        type: message.type,
        content: message.text
      }
      messages.push(msg)
    } else {
      let bufferArr = await submit.decodeBase64(message.id, config)
      let _file = submit.fileExtension(message)
      let url = await submit.uploadStorage(message.id, bufferArr, _file)
      let msg = {
        type: message.type,
        content: url
      }
      messages.push(msg)
    }
  }
  return messages
}

async function fetchCurrentEmployee() {
  let currentEmployee = await firebase.fetchCurrentEmployee()
  return currentEmployee.data()
}

async function pushLineMessageApi(lineUid) {
  const msg = [{
      type: 'text',
      text: 'มีงานเข้า'
    },
    {
      type: 'sticker',
      id: '11603834203334',
      stickerId: '13',
      packageId: '1',
      stickerResourceType: 'STATIC'
    }
  ]
  answerArry = []
  client.pushMessage(lineUid, msg)
}

app.get('/', (req, res) => {
  res.send('status code 200 ok')
})
exports.messagingAPI = functions.https.onRequest(app)