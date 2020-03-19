const functions = require('firebase-functions');
const express = require('express')
const app = express()
const line = require('@line/bot-sdk')
const fs = require('fs')
const os = require('os')
const path = require('path')
const UUID = require('uuid-v4')
const moment = require('moment')
const request = require('request-promise')
const { db, bucket } = require('./config')
const port = process.env.PORT || 5000

const config = {
  channelAccessToken: 'nCmRcgR2JrELs12rskiWB3X4feG6fEwe5OvZkIDICgHQzu+pM9I4yG9iVpbzW2qLerhHKg5931Lvq7hy8ZHR8rr+47omQsUZVp/zDCwJ20ZYxgE0aJMN3wBDaZw8Jyx8Ocsf0ZWYITbC7s8Mr9Y9aQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eac5b8a6040ad91451ee24fbc261d7d9'
};
var answerArry = []
var append = false
statusSubmit = ''
const client = new line.Client(config);

app.post('/webhook', line.middleware(config), async (req, res) => {
  for (let index = 0; index < req.body.events.length; index++) {
    const event = req.body.events[index];
    const { message, replyToken } = event
    var clearTime = setTimeout(() => {
      autoSubmit(answerArry, replyToken)
    }, 20000) //ทำพร้อมกับที่ส่งข้อความเข้ามา
    console.log(event)

    switch (message.text) {
      case 'submit':
        console.log('main- 1000')
        let data = await processConvertMessages(answerArry)
        console.log('main- 2000')

        let refJob = await saveToFirestore(data)
        console.log('main- 3000')

        replyRefJob(replyToken, refJob)
        console.log('main- 3100')

        let user = await fetchCurrentEmployee()
        console.log('main- 4000')

        await pushLineMessageApi(user.uidLine)
        console.log('main- 5000')
        answerArry = []
        statusSubmit = 'submit'
        clearTimeout(clearTime) // clear setTimeOut เมื่อกด submit
        break;
      case 'append':
        client.replyMessage(replyToken, { type: 'text', text: 'ขอทราบรหัสงาน' })
        append = true
        break;
      case 'working':
        let currentUser = await fetchCurrentEmployee()
        client.replyMessage(replyToken, { type: 'text', text: currentUser.displayName})
        break;
      default:
        if (append) {
          appendJob(message, replyToken) 
        } else {
          answerArry.push(message)
          statusSubmit = 'pending'
        }
        break;
    }
  }
  res.send("OK")
})


// SUBMIT
async function processConvertMessages(answerArry) {
  let messages = []
  for (let index = 0; index < answerArry.length; index++) {
    const message = answerArry[index];
    if (message.type === 'text') {
      var msg = {
        type: message.type,
        content: message.text
      }
    } else if (message.type === 'image') {
      let bufferArr = await decodeBase64(message.id)
      let url = await uploadStorage(message.id, bufferArr)
      var msg = {
        type: message.type,
        content: url
      }
    }
    messages.push(msg)
  }
  return messages
}

async function decodeBase64 (messageID) {
    let bufferArr = []
    console.log('200')
    let buffer = await request.get({
      headers: {
        'Authorization': `Bearer ${config.channelAccessToken}`
      },
      url: `https://api-data.line.me/v2/bot/message/${messageID}/content`,
      encoding: null
    })
    console.log('201')
    bufferArr.push(buffer)
    return bufferArr
}

async function uploadStorage(messagID, bufferArr) {
  try {
    for (let i = 0; i < bufferArr.length; i++) {
      const buffer = bufferArr[i];
      const tempLocalFile = path.join(os.tmpdir(), 'photo.jpg') // create directory ชั่วคราว พร้อมกับตั้งชื่อไฟล์
      fs.writeFileSync(tempLocalFile, buffer)  // เขียนไฟล์โดนใช้ ชื่อ directory
      console.log('300')
      await bucket.upload(tempLocalFile, {
        destination: `${messagID}.jpg`,
        metadata: {
          cacheControl: 'no-cache',
          metadata: {
            firebaseStorageDownloadTokens: UUID()
          }
        }
      })
      fs.unlinkSync(tempLocalFile)
      console.log('301')
      return `https://firebasestorage.googleapis.com/v0/b/chatbot-it-support.appspot.com/o/${messagID}.jpg?alt=media`
    }
  } catch (err) {
    console.log(err)
  }
}

async function fetchCurrentEmployee() {
  let currentEmployee = await db.collection('appState').doc('currentUser').get()
  return currentEmployee.data()
}

async function saveToFirestore(answer, message) {
  let randomNumber = (Math.random() * 1000000).toFixed(0)
  let data = {
    createdTimestamp: moment().format('x'),
    message: answer,
    status: '',
    ref: randomNumber
  }
  db.collection('jobs').add(data)
  return randomNumber
}

function replyRefJob(replyToken, refJob) {
  let msg = {
    type: 'text',
    text: `รหัสงาน: ${refJob}`
  }
  client.replyMessage(replyToken, msg)
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
  client.pushMessage(lineUid, msg)
}

function autoReplyMessage(replyToken) {
  let msg = {
    type: 'text',
    text: 'Submit Success!!'
  }
  client.replyMessage(replyToken, msg)
}

async function autoSubmit (answerArry, replyToken) {
  try {

    if (statusSubmit === 'pending') { 
      statusSubmit = 'submit'
      let data = await processConvertMessages(answerArry)
      let refJob = await saveToFirestore(data)
      replyRefJob(replyToken, refJob)
      let user = await fetchCurrentEmployee()
      await pushLineMessageApi(user.uidLine)
      autoSubmit(answerArry)
      autoReplyMessage(replyToken)
      console.log('submit success')
    } else {
      console.log('worker')
    }
  } catch (e) {
    console.error(e)
  }
}
// SUBMIT



// APPEND
async function appendJob(message, replyToken) {
  let jobDocId = await searchRefJobs(message)
  if (jobDocId) {
    var job = await db.collection('jobs').doc(jobDocId).get()
    job = job.data()
  } else {
    client.replyMessage(replyToken, { type: 'text', text: 'ไม่พบงาน' })
    append = false
  }
  console.log(job)
}

async function searchRefJobs(message) {
  var jobDocId = ''
  let refJob = await db.collection('jobs').where('ref', '==' , message.text).get()
  refJob.forEach(snapshot => {
    jobDocId = snapshot.id
  })
  return jobDocId
}

app.listen(port, () => {
  console.log(`listening on ${port}`)
})

exports.messagingAPI = functions.https.onRequest(app)