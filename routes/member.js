var express = require('express');
var router = express.Router();

const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

// 회원가입
// 이메일, 암호, 이름 받기
// 등록일 자동생성
// localhost:3000/member/insert
router.post('/insert', async function(req, res, next) {
  try{
    console.log(req.body);

    const dbconn = await db.connect(dburl);

    const obj = {
      _id: req.body.email,
      pw: Number(req.body.password),
      name: req.body.name,
      regdate: new Date()
    }

    console.log("객체 확인", obj);

    const collection   = dbconn.db(dbname).collection('member1');
    const result       = await collection.insertOne(obj);
    
    console.log('------------------');
    console.log("result 값 확인", result);

    if(result.insertedId === obj._id){
      return res.send({status:200});
    }
    return res.send({status:0});

    
  }
  catch(e){
    console.error(e);
    res.send({status:999});
  }
});

module.exports = router;
