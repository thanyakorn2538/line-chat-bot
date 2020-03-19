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
// const port = process.env.PORT || 5000

const config = {
  channelAccessToken: 'nCmRcgR2JrELs12rskiWB3X4feG6fEwe5OvZkIDICgHQzu+pM9I4yG9iVpbzW2qLerhHKg5931Lvq7hy8ZHR8rr+47omQsUZVp/zDCwJ20ZYxgE0aJMN3wBDaZw8Jyx8Ocsf0ZWYITbC7s8Mr9Y9aQdB04t89/1O/w1cDnyilFU=',
  channelSecret: 'eac5b8a6040ad91451ee24fbc261d7d9'
};
var answerArry = []
var appendBool = false
var jobIdBool = false
var jobIdGlobal = ''
statusSubmit = ''
const client = new line.Client(config);

app.get('/', (req, res) => {
  res.send('status code 200 ok')
})

app.post('/webhook', line.middleware(config), async (req, res) => {
  for (let index = 0; index < req.body.events.length; index++) {
    const event = req.body.events[index];
    const { message, replyToken } = event
    console.log(event)
    // var clearTime = setTimeout(() => {
    //   autoSubmit(answerArry, replyToken)
    // }, 10000) //ทำพร้อมกับที่ส่งข้อความเข้ามา
    switch (message.text) {
      case 'submit': {
        console.log('main- 1000')
        /* eslint-disable no-await-in-loop */
        let data = await processConvertMessages(answerArry)
        console.log('main- 2000')

        /* eslint-disable no-await-in-loop */
        let refJob = await saveToFirestore(data)
        console.log('main- 3000')

        replyRefJob(replyToken, refJob)
        console.log('main- 3100')

        /* eslint-disable no-await-in-loop */
        let user = await fetchCurrentEmployee()
        console.log('main- 4000')

        pushLineMessageApi(user.uidLine)
        console.log('main- 5000')
        answerArry = []
        statusSubmit = 'submit'
        break;
      }
      case 'append':
        client.replyMessage(replyToken, { type: 'text', text: 'ขอทราบรหัสงาน' })
        appendBool = true
        break;
      case 'working': {
        /* eslint-disable no-await-in-loop */
        let currentUser = await fetchCurrentEmployee()
        client.replyMessage(replyToken, { type: 'text', text: currentUser.displayName})
        break;
      }
      default:
        if (appendBool) {
          if (!jobIdBool) {
            searchJobsId(message, replyToken)
            console.log('search')
          } else {
            switch (message.text) {
              case 'submit up': {
                appendJob(answerArry, jobIdGlobal, replyToken)
                console.log('append')
                break;
              }
              default:
                answerArry.push(message)
                console.log('push')
                console.log(answerArry)
              break;
            }
          }
        } else {
          statusSubmit = 'pending'
          answerArry.push(message)
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
      let msg = {
        type: message.type,
        content: message.text
      }
      messages.push(msg)
    } else {
      let bufferArr = await decodeBase64(message.id)
      let _file = fileExtension(message)
      let url = await uploadStorage(message.id, bufferArr, _file)
      let msg = {
        type: message.type,
        content: url
      }
      messages.push(msg)
    }
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

function fileExtension(message) {
  console.log('202')
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

async function uploadStorage(messageID, bufferArr, _file) {
  for (let i = 0; i < bufferArr.length; i++) {
    const buffer = bufferArr[i];
    const tempLocalFile = path.join(os.tmpdir(), `fileName.${_file}`) // create directory ชั่วคราว พร้อมกับตั้งชื่อไฟล์
    fs.writeFileSync(tempLocalFile, buffer)  // เขียนไฟล์โดยใช้ ชื่อ directory คือ tempLocalFile
    console.log('300')
    await bucket.upload(tempLocalFile, {
      destination: `${messageID}.${_file}`,
      metadata: {
        cacheControl: 'no-cache',
        metadata: {
          firebaseStorageDownloadTokens: UUID()
        }
      }
    })
    fs.unlinkSync(tempLocalFile)
    console.log('301')
  }
  return `https://firebasestorage.googleapis.com/v0/b/chatbot-it-support.appspot.com/o/${messageID}.${_file}?alt=media`
}

async function fetchCurrentEmployee() {
  let currentEmployee = await db.collection('appState').doc('currentUser').get()
  return currentEmployee.data()
}

async function saveToFirestore(answer) {
  let randomNumber = (Math.random() * 1000).toFixed(0)
  let jobId = `${moment().format('YYYYMMDD')}#${randomNumber}`
  let data = {
    createdTimestamp: moment().format('x'),
    message: answer,
    status: '',
    jobId: jobId
  }
  db.collection('jobs').add(data)
  return jobId
}

function replyRefJob(replyToken, refJob) {
  var msg = {
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
  answerArry = []
  client.pushMessage(lineUid, msg)
}

async function autoSubmit (answerArry, replyToken) {
  if (statusSubmit === 'pending') { 
    statusSubmit = 'submit'
    let data = await processConvertMessages(answerArry)
    let refJob = await saveToFirestore(data)
    replyRefJob(replyToken, refJob)
    let user = await fetchCurrentEmployee()
    await pushLineMessageApi(user.uidLine)
    // autoReplyMessage(replyToken)
    answerArry = []
    console.log('submit success')
  } else {
    console.log('worker')
  }
}

// function autoReplyMessage(replyToken) {
//   let msg = {
//     type: 'text',
//     text: 'Submit Success!!'
//   }
//   client.replyMessage(replyToken, msg)
// }
// SUBMIT



// APPEND
// todo: ทำให้ไม่เขียนทับ
async function appendJob(answerArry, jobId, replyToken) {
  let data = await processConvertMessages(answerArry)
  db.collection('jobs').doc(jobId).update({
    append: data
  })
  updateSuccess(replyToken)
  answerArry = []
  jobIdBool = false
  appendBool = false
}

function updateSuccess(replyToken) {
  client.replyMessage(replyToken, { type: 'text', text: 'อัพเดทสำเร็จ' })
}

async function searchJobsId(message, replyToken) {
  var jobId = null
  let refJob = await db.collection('jobs').where('jobId', '==' , message.text).get()
  refJob.forEach(snapshot => {
    jobId = snapshot.id
  })
  replyMessageJob(replyToken, jobId)
  jobIdGlobal = jobId
}

async function replyMessageJob(replyToken, jobId) {
  if (jobId) {
    // var job = await db.collection('jobs').doc(jobId).get()
    // job = job.data()
    client.replyMessage(replyToken, { type: 'text', text: 'เจองานแย้ว'})
    jobIdBool = true
  } else {
    client.replyMessage(replyToken, { type: 'text', text: 'ไม่พบงาน' })
    appendBool = false
  }
}
// APPEND

// app.listen(port, () => {
//   console.log(`listening on ${port}`)
// })

exports.messagingAPI = functions.https.onRequest(app)