var express = require('express');
var router = express.Router();

const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

// 로그인: 토큰 발행을 위한 필요 정보 가져오기
const jwt = require('jsonwebtoken');

const jwtKey = require('../config/auth').securityKey;
const jwtOptions = require('../config/auth').options;
const checkToken = require('../config/auth').checkToken;

// 회원가입: 문자를 HASH하기(암호 보안)
const crypto = require('crypto');

// 회원가입
// 이메일(PK), 암호, 이름 받기
// 등록일(자동생성)
// 등록일 자동생성
// localhost:3000/member/insert
router.post('/insert', async function(req, res, next) {
  try{
    console.log(req.body);

    // HASH 비밀번호
    // 사용자1 aaa => wefwefw69898wg689 => 16진수로
    const hashPassword = crypto.createHmac('sha256', req.body.email)
      .update(req.body.password).digest('hex');

    const obj = {
      _id: req.body.email,
      pw: hashPassword,
      name: req.body.name,
      regdate: new Date()
    }

    console.log("객체 확인", obj);

    const dbconn = await db.connect(dburl);
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

// 로그인 post (암호때문에 get 사용불가)
// 이메일, 암호 => 현시점에서 생성된 토큰을 전송
// localhost:3000/member/select
router.post('/select', async function(req, res, next) {
  try{
    // 1. 전송값 받기(이메일, 암호)
    const email = req.body.email;
    const pw    = req.body.password;

    // 2. 암호는 바로 비교 불가, 회원가입과 동일한 hash 후에 비교
    const hashPassword = crypto.createHmac('sha256', email)
      .update(pw).digest('hex');

    // 3. 회원정보가 일치하면 토큰을 발행
    const dbconn = await db.connect(dburl);
    const collection   = dbconn.db(dbname).collection('member1');
    // 이메일과 hash한 암호가 둘 다(AND) 일치
    const result       = await collection.findOne({
      _id: email, pw: hashPassword
    });

    if (result !== null) { // 로그인 가능
      const token = jwt.sign(
        { uid : email, uname: result.name },   // 토큰에 포함할 내용들...
        jwtKey,   // 토큰 생성시 키값
        jwtOptions,   // 토큰 생성 옵션
      );
      return res.send({status:200, token:token});
    }
    
    return res.send({status:0});

  }
  catch(e){
    console.error(e);
    res.send({status:999});
  }
});

// 이메일 중복확인 get
// 이메일 => 결과
// localhost:3000/member/emailcheck
router.get('/emailcheck', async function(req, res, next) {
  try{
    // 1. db 연결, db선택, 컬렉션 선택
    const dbconn = await db.connect(dburl);
    const collection   = dbconn.db(dbname).collection('member1');

    // 2. 일치하는 개수 리턴 0 또는 1
    const result       = await collection.countDocuments({
      _id: req.query.email
    });
    
    return res.send({status:200, result: result});

  }
  catch(e){
    console.error(e);
    res.send({status:999});
  }
});

// 회원정보수정 put
// localhost:3000/member/update
// 이메일(PK), 이름(변경할 내용)
router.put('/update', checkToken, async function(req, res, next) {
  try{
    console.log('이메일:', req.body.uid);
    console.log('기존이름:', req.body.uname);
    console.log('변경할이름:', req.body.name);

    // DB연동
    const dbconn = await db.connect(dburl);
    const collection   = dbconn.db(dbname).collection('member1');

    // 정보 변경
    const result       = await collection.updateOne(
      { _id: req.body.uid },
      { $set : { name: req.body.name } }
    );

    // DB 수행 후 반환되는 결과 값에 따라 적절한 값을 전달
    if (result.modifiedCount === 1 ) {
      return res.send({status: 200});
    }
    return res.send({status: 0});

  }
  catch(e){
    console.error(e);
    res.send({status:-1, message: e});
  }
});

// 회원암호변경 put
// localhost:3000/member/updatepw
// 토큰 이메일, 현재암호, 변경할 암호
router.put('/updatepw', checkToken, async function(req, res, next) {
  try{
    console.log(req.body);
    // 토큰에서 꺼낸 정보
    const email = req.body.uid;
    const pw    = req.body.password;
    const pw1    = req.body.password1;
    
    const hashPassword = crypto.createHmac('sha256', email)
      .update(pw).digest('hex');

    // DB연동
    const dbconn = await db.connect(dburl);
    const collection   = dbconn.db(dbname).collection('member1');

    const result       = await collection.findOne({
      _id: email, pw: hashPassword
    });

    if (result !== null ) {
      const hashPassword1 = crypto.createHmac('sha256', email)
      .update(pw1).digest('hex');

      const result1 = await collection.updateOne(
        {_id: email},
        { $set : {pw : hashPassword1} }
      );

      if (result1.modifiedCount === 1 ) {
        return res.send({status: 200});
      }
      
    }
    return res.send({status: 0});

  }
  catch(e){
    console.error(e);
    res.send({status:-1, message: e});
  }
});

// 회원탈퇴 delete
// localhost:3000/member/delete
router.delete('/delete', checkToken, async function(req, res, next) {
  try{
    
    // 토큰에서 꺼낸 정보
    const email = req.body.uid;
    const pw    = req.body.password;
    

    console.log(pw);
    const hashPassword = crypto.createHmac('sha256', email)
      .update(pw).digest('hex');

    // DB연동
    const dbconn = await db.connect(dburl);
    const collection   = dbconn.db(dbname).collection('member1');

    const result       = await collection.findOne({
      _id: email, pw: hashPassword
    });
    console.log('----------------------------');
    console.log('로그인 확인',result);

    if (result !== null ) {
      const result1 = await collection.deleteOne(
        { _id : email }
      );

      console.log(result1);

      if (result1.deletedCount === 1 ) {
        return res.send({status: 200});
      }
    }
    // 로그인 실패시
    return res.send({status: 0});

  }
  catch(e){
    console.error(e);
    res.send({status:-1, message: e});
  }
});

module.exports = router;
