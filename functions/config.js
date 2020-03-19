var admin = require("firebase-admin");
var serviceAccount = require("./chatbot-it-support-firebase-adminsdk-cm6hy-79cb6d7140.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "chatbot-it-support.appspot.com",
  databaseURL: "https://chatbot-it-support.firebaseio.com"
})

const bucket = admin.storage().bucket('chatbot-it-support.appspot.com');
const db = admin.firestore()

module.exports = {
  db,
  bucket
}
