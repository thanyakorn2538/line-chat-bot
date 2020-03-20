const { db, bucket } = require('../config')
const UUID = require('uuid-v4')

class firestore {
  create (payload) {
    db.collection('jobs').add(payload)
  }

  update (jobId, payload) {
    db.collection('jobs').doc(jobId).update(payload)
  }

  getDocRef(messageText) {
    return db.collection('jobs').where('jobId', '==', messageText).get()
  }

  fetchCurrentEmployee () {
    return db.collection('appState').doc('currentUser').get()
  }

  async bucketUpload(directoryFile, messageId, _file) {
    await bucket.upload(directoryFile, {
      destination: `${messageId}.${_file}`,
      metadata: {
        cacheControl: 'no-cache',
        metadata: {
          firebaseStorageDownloadTokens: UUID()
        }
      }
    })
  } 
}

module.exports = firestore