const firebaseService = require('../service/firebase-service')

class append {
  constructor () {
    this.firebase = new firebaseService()
  }

  async fetchDocId(message) {
    var docId = null
    let docRef = await this.firebase.getDocRef(message.text)
    docRef.forEach(snapshot => {
      docId = snapshot.id
    })
    if (!docId) {
      appendBool = false
    }
    return docId
  }

  updateToFirebase (docId, dataAppend){
    if (docId) {
      let payload = {
        append: dataAppend
      }
      this.firebase.update(docId, payload)
    }
  }
}

module.exports = append