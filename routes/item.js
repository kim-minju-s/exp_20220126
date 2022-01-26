var express = require('express');
var router = express.Router();

const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

const multer = require('multer');
const upload = multer({storage: multer.memoryStorage()});

// item1 에 항목을 추가하는 것
// localhost:3000/item/insert
// 전송되는 값: name, content, price, quantity, image
// 자동으로 생성: _id, regdate
router.post('/insert',upload.single("image"), async function(req, res, next) {
  try{

    console.log("전송할 데이터 값", req.body);
    console.log("전송할 파일 값", req.file);

    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('sequence');
    const result = await collection.findOneAndUpdate(
      { _id:'SEQ_ITEM1_NO' },    // 가지고 오기 위한 조건
      { $inc: { seq:1 } }         // seq 값을 1 증가시킴
    );

    console.log('---------------------');
    console.log(result);

    const obj = {
      _id: result.value.seq,
      content:req.body.content,
      price:Number(req.body.price),
      quantity:Number(req.body.quantity),

      filename: req.file.originalname,
      filedata: req.file.buffer,
      filetype: req.file.mimetype,
      filesize: req.file.size,
      regdata: new Date()
    }

    const collection1   = dbconn.db(dbname).collection('item1');
    const result1       = await collection1.insertOne(obj);
    console.log('----------------------------');
    console.log(result1);

    if(result.value.seq === result1.insertedId){
      return res.send({status: 200});
    }
    return res.send({status: 0});
    
  }
  catch(e){
    console.error(e);
    res.send({status: 999});
  }
  
});

module.exports = router;
