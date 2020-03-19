const functions = require('firebase-functions');
const admin = require('firebase-admin')
require('firebase/storage')
require('firebase/firestore')
const express = require('express')
const app = express()
const line = require('@line/bot-sdk')
const axios = require('axios')
var serviceAccount = require("./chatbot-it-support-firebase-adminsdk-cm6hy-79cb6d7140.json");
const fs = require('fs')
const os = require('os')
const path = require('path')
const UUID = require('uuid-v4')
const port = process.env.PORT || 5000
const request = require('request-promise')

const enpoint = 'https://us-central1-chatbot-it-support.cloudfunctions.net/backendAPI'
const config = {
  channelAccessToken: 'nCmRcgR2JrELs12rskiWB3X4feG6fEwe5OvZkIDICgHQzu+pM9I4yG9iVpbzW2qLerhHKg5931Lvq7hy8ZHR8rr+47omQsUZVp/zDCwJ20ZYxgE0aJMN3wBDaZw8Jyx8Ocsf0ZWYITbC7s8Mr9Y9aQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eac5b8a6040ad91451ee24fbc261d7d9'
};
const client = new line.Client(config);
let answerArry = []

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "chatbot-it-support.appspot.com",
  databaseURL: "https://chatbot-it-support.firebaseio.com"
})
// var bucket = admin.storage().bucket()
var db = admin.firestore()

app.post('/webhook', line.middleware(config), async (req, res) => {

  //fetch current employee

  for (let index = 0; index < req.body.events.length; index++) {
    const event = req.body.events[index];

    const {
      message,
      replyToken
    } = event

    switch (message.text) {
      case 'submit':
        await saveToFirestore()
        let user = await fetchCurrentEmployee()
        await pushLineMessageApi(user.lineUid)

        break;

      default:
        // pending
        appendMessages()
        break;
    }



    //case pending messages




  }


  // Promise
  //   .all(req.body.events.map(handleEvent))
  //   .then((result) => res.json(result))
  // .catch(e) 
  //   console.log(e)
})

function handleEvent(event) {
  const {
    message,
    replyToken
  } = event
  console.log(event)
  // handleImageEvent(message, replyToken, event)
  if (event.message.text === 'submit') {
    saveToFirestore()
  } else {
    handleMessageEvent(message, replyToken, event);
  }
}

async function decodeBase64_uploadStorage(message, replyToken, event) {
  let buffer = await request.get({
    headers: {
      'Authorization': `Bearer ${config.channelAccessToken}`
    },
    url: `https://api-data.line.me/v2/bot/message/${message.id}/content`,
    encoding: null
  })

  const tempLocalFile = path.join(os.tmpdir(), 'photo.jpg')
  fs.writeFileSync(tempLocalFile, buffer)

  const bucket = admin.storage().bucket('chatbot-it-support.appspot.com')

  await bucket.upload(tempLocalFile, {
    destination: `${message.id}.jpg`,
    metadata: {
      cacheControl: 'no-cache',
      metadata: {
        firebaseStorageDownloadTokens: UUID()
      }
    }
  })
  fs.unlinkSync(tempLocalFile)
}


async function fetchCurrentEmployee() {
  let currentEmployee = await db.collection('appState').doc('currentUser').get().data()
  return currentEmployee
}

// firestore 
async function saveToFirestore() {
  const res = await axios({
    method: 'POST',
    url: `${enpoint}/postjobs`,
    data: {
      message: answerArry
    }
  })
  answerArry = []
  uidLine = res.data.data.uidLine
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
  client.pushMessage(res.data.data.uidLine, msg)
}

async function pushLineMessageApi(params) {
  const res = await axios({
    method: 'POST',
    url: `${enpoint}/postjobs`,
    data: {
      message: answerArry
    }
  })
  answerArry = []
  uidLine = res.data.data.uidLine
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
  client.pushMessage(res.data.data.uidLine, msg)

}

async function handleImageEvent(message, replyToken, event) {

  let steam = await client.getMessageContent(message.id)
  steam.once('data', (chunk) => {
    console.log('one ========', chunk)
  })
  steam.once('error', (error) => {
    console.log(error)
  })
}

function handleMessageEvent(message, replyToken, event) {
  if (message.type === 'text') {
    let msg = {
      type: message.type,
      content: message.text
    }
    answerArry.push(msg)
  } else {
    decodeBase64_uploadStorage(message, replyToken, event)
    let msg = {
      type: message.type,
      content: `https://firebasestorage.googleapis.com/v0/b/chatbot-it-support.appspot.com/o/${message.id}.jpg?alt=media`
    }
    answerArry.push(msg)
  }
  console.log('arry: ======', answerArry)
}

app.listen(port, () => {
  console.log(`listening on ${port}`)
})

exports.messagingAPI = functions.https.onRequest(app)