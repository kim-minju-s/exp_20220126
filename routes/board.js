var express = require('express');
var router = express.Router();

// 데이터베이스와 연동
// https://github.com/mongodb/node-mongodb-native
// CMD> npm i mongodb --save
// const { MongoClient } = require('mongodb');
const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

// 특정 폴더에 파일 첨부
// https://github.com/mongodb/node-mongodb-native
//CMD> npm i install multer --save
const multer = require('multer');
const upload = multer({storage: multer.memoryStorage()});

// insert, update, delete, select ... 
// POST: insert,
// PUT: update,
// DELETE: delete,
// GET: select,

// localhost:3000/board/insert
// title, content, writer, image
// _id, regdate
router.post('/insert', upload.single("image"), async function(req, res, next) { //데이터 들어오기, 내보내기
    try{
        // 1. DB 접속
        const dbconn = await db.connect(dburl);
        // 2. DB 선택 및 컬렉션 선택
        const collection = dbconn.db(dbname).collection('sequence');
        // 3. 시퀀스에서 값을 가져오고, 그 다음을 위해서 증가시킴
        const result = await collection.findOneAndUpdate(
            { _id:'SEQ_BOARD1_NO' },    // 가지고 오기 위한 조건
            { $inc: { seq:1 } }         // seq 값을 1 증가시킴
        );

        console.log("받아오는 데이터 값", req.body);
        console.log("받아오는 파일 데이터 값", req.file);

        console.log('-----------------------------------');
        // 4. 정상 동작을 위한 결과 확인
        console.log(result);    //value.seq 값이 1씩 증가하는 걸 확인

        const obj = {
            _id     : result.value.seq,
            title   : req.body.title,
            content : req.body.content,
            writer  : req.body.writer,
            hit     : 1,

            filename: req.file.originalname,
            filedata: req.file.buffer,
            filetype: req.file.mimetype,
            filesize: req.file.size,
            regdate : new Date()
        }

        // 추가할 컬렉션 선택
        const collection1   = dbconn.db(dbname).collection('board1');
        // 추가하기
        const result1       = await collection1.insertOne(obj);
        // 추가 확인하기
        console.log(result1);
        if(result1.insertedId === result.value.seq){
            return res.send({status:200});
        }
        return res.send({status:0});

    }
    catch(e) {
        console.error(e);
        res.send({status: 999});
    }
});

// localhost:3000/board/image?_id=110
// 출력하고자 하는 이미지의 게시물 번호를 전달
router.get('/image', async function(req, res, next){
    try{
        const no = Number(req.query['_id']);
        //const no = req.query._id

        // db연결, db선택, 컬렉션 선택
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 이미지 정보 가져오기
        const result = await collection.findOne(
            { _id: no }, // 조건
            { projection: {filedata:1, filetype:1} }, // 필요한 항목만 projection
        );

        console.log(result);

        // 형식을 변환하기 application/json -> image/png
        // 이미지나 오디오를 보기 위함
        res.contentType(result.filetype);

        return res.send(result.filedata.buffer); //application/json 형식
    }
    catch(e){
        console.error(e);
        res.send({status: 999});
    }
});

// localhost:3000/board/select?page=1&text=검색어
router.get('/select', async function(req, res, next){
    try{    // get 은 query 로만 받을 수 있음
        const page = Number(req.query.page); //페이지 번호
        const text = req.query.text; // 검색어

        // db연결, db선택, 컬렉션 선택
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('board1');

        // find(조건).sort(정렬)).toArray() 로 사용
        // abc => a, b, c
        const result = await collection.find(
            { title: new RegExp(text, 'i')},
            { projection: { _id: 1, title: 1, writer:1, hit: 1, regdate: 1 } }
        )
        .sort({_id: -1})
        .skip( (page-1)*10 )
        .limit(10)
        .toArray(); // 오라클, mysql SQL 문 => SELECT * FROM ORDER BY _ID DESC...

        // 결과 확인
        console.log(result);

        // 검색어가 포함된 전체 게시물 갯수 => 페이지 네이션 번호 생성시 필요
        const result1 = await collection.countDocuments(
            {title: new RegExp(text, 'i')},
        );

        return res.send({status:200, rows: result, total: result1});

    }
    catch(e){
        console.error(e);
        res.send({status: -1, message: e});
    }
});
module.exports = router;
