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
        console.log('파일 정보---->',obj);

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
// 목록
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
            { content: new RegExp(text, 'i')},
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

// localhost:3000/board/selectone?no=126
// 게시판 상세 내용
router.get('/selectone', async function(req, res, next){
    try{

        // 1. 전송되는 값 받기(형변환에 주의)
        const no = Number(req.query.no);

        // 2. db연결, db선택, 컬렉션 선택
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. db에서 원하는 값 가져오기( findOne(1개) or find(n개) )
        const result = await collection.findOne(
            { _id : no }, // 조건
            { projection: {filedata:0, filename:0, filesize:0, filetype:0} }, // 필요한 컬럼만
        );
        console.log('result---->',result);

        // 4. 가져온 정보에서 이미지 정보를 추가함
        // 이미지 URL, 이전글 번호, 다음글 번호
        result['imageurl'] = '/board/image?_id=' + no;

        // {_id: {$lt: 113}}    // 113미만
        // {_id: {$lte: 113}}    // 113이하
        // {_id: {$gt: 113}}    // 113초과
        // {_id: {$gte: 113}}    // 113이상

        const prev = await collection.find(
            { _id: {$lt: no} }, // 조건
            { projection: { _id: 1 } }  //필요한 컬럼만
        ).sort({ _id : -1 }).limit(1).toArray();

        if( prev.length > 0 ){ // 이전글이 존재한다면
            result['prev'] = prev[0]._id;
        }
        else{ // 이전글이 없다면
            result['prev'] = 0;
        }
        console.log(prev);  // [ { _id: 121 } ] or []


        const next = await collection.find(
            { _id: {$gt: no} },
            { projection: { _id: 1 } }
        ).sort({ _id : 1 }).limit(1).toArray();

        if ( next.length > 0 ) {
            result['next'] = next[0]._id;
        }
        else{
            result['next'] = 0;
        }
        console.log(next);

        // 같은것 : find( {_id: 113} )   find( {_id: {$eq: 113}} )
        // 같지 않음 : find( {_id: {$ne: 113}} )
        // 포함 : find( {_id: {$in: [113, 114, 115] }} )

        // 조건 2개 일치 and
        // find( {_id: 113, hit: 34} )
        // find( { $and: [{_id: 113}, {hit: 34}] } )

        // 조건 2개 중 1개만 or
        // find( { $or: [{_id: 113}, {hit: 34}] } )


        console.log(result);
        res.send({status: 200, result: result});

    }
    catch(e){
        console.error(e);   // 개발자가 확인하는 용도
        res.send({status: -1, message: e}); // 프론트로 전달함.
    }
});

// localhost:3000/board/updatehit?no=126
// 조회수 10씩 증가
router.put('/updatehit', async function(req, res, next){
    try{
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);

        // 2. db 연동
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. 조회수 증가
        const result = await collection.updateOne(
            { _id : no },   // 조건
            { $inc : { hit: 2 } }  // 실제 수행할 내용
        );

        // 4. DB 수행 후 반환되는 결과 값에 따라 적절한 값을 전달
        if (result.modifiedCount === 1) {
            return res.send({status: 200});
        }
        return res.send({status: 0});
        
    }
    catch(e){
        console.error(e);
        res.send({status: -1, message: e});
    }
});

// localhost:3000/board/delete?no=124
// 글 삭제
router.delete('/delete', async function(req, res, next){
    try{
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);

        // 2. db 연동
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. 조회수 증가
        const result = await collection.deleteOne(
            { _id : no },   // 조건
        );

        // 4. 결과 반환
        if (result.deletedCount === 1) {
            return res.send({status: 200});
        }
        return res.send({status: 0});
        
    }
    catch(e){
        console.error(e);
        res.send({status: -1, message: e});
    }
});

// localhost:3000/board/update?no=125
// 글 수정 : 글번호, 제목, 내용, 작성자
router.put('/update', async function(req, res, next){
    try{
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);    // query
        const title = req.body.title;       // body
        const content = req.body.content;   // body

        // 2. db 연동
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('board1');

        // 3. 변경 수행
        const result = await collection.updateOne(
            { _id : no },   // 조건
            { $set : { title: title, content: content } }  // 실제 수행할 내용
        );

        // 4. DB 수행 후 반환되는 결과 값에 따라 적절한 값을 전달
        if (result.modifiedCount === 1 ) {
            return res.send({status: 200});
        }
        return res.send({status: 0});
        
    }
    catch(e){
        console.error(e);
        res.send({status: -1, message: e});
    }
});

// localhost:3000/board/insertreply
// 답글 쓰기
// 기본키: 답글 번호(자동) - 줄별 데이터를 구분하는 고유한 값
// 내용, 작성자 - 데이터
// 외래키: 원글 번호(board1) - 다른곳(board1의 글번호)의 데이터로만 구성해야됨
// 등록일(X) - 데이터
router.post('/insertreply', async function(req, res, next) {
    try{
         // 1. DB 접속
         const dbconn = await db.connect(dburl);
         // 2. DB 선택 및 컬렉션 선택
         const collection = dbconn.db(dbname).collection('sequence');
         // 3. 시퀀스에서 값을 가져오고, 그 다음을 위해서 증가시킴
         const result = await collection.findOneAndUpdate(
             { _id:'SEQ_BOARDREPLY1_NO' },    // 가지고 오기 위한 조건
             { $inc: { seq:1 } }         // seq 값을 1 증가시킴
         );
         const obj = {
             _id: result.value.seq, // 기본키(PK) - 답글번호
             content: req.body.content,      // 답글 내용
             writer: req.body.writer,        // 답글 작성자
             boardno: Number(req.body.boardno),      // 외래키(FK) - 원글 번호
             regdate: new Date()    // 답글 작성일자
         }

         const collection1 = dbconn.db(dbname).collection('boardreply1');
         const result1 = await collection1.insertOne(obj);

         if (result1.insertedId === result.value.seq) {
             return res.send({status: 200});
         }
        
        return res.send({status: 0});
    }
    catch(e) {
        console.error(e);
        res.send({status: 999});
    }
});

// localhost:3000/board/selectreply?no=126
// 답글 조회
router.get('/selectreply', async function(req, res, next) {
    try{
        // 1. 전송되는 값 받기(형변환에 주의)
        const no = Number(req.query.no);

        // 2. db연결, db선택, 컬렉션 선택
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('boardreply1');

        // 3. db에서 원하는 값 가져오기( findOne(1개) or find(n개) )
        const result = await collection.find(
            { boardno : no }, // 조건
        ).toArray();
        
        // 4. 전달하기
        return res.send({status: 200, result: result});
    }
    catch(e) {
        console.error(e);
        res.send({status: 999});
    }
});

// localhost:3000/board/deletereply?no=19
// 답글 삭제
router.delete('/deletereply', async function(req, res, next){
    try{
        // 1. 전달되는 값 받기
        const no = Number(req.query.no);

        // 2. db 연동
        const dbconn = await db.connect(dburl);  //연결
        const collection = dbconn.db(dbname).collection('boardreply1'); //컬랙션 선택

        const result = await collection.deleteOne(
            { _id : no },   // 조건
        );

        // 4. 결과 반환
        if (result.deletedCount === 1) {
            return res.send({status: 200});
        }
        return res.send({status: 0});
        
    }
    catch(e){
        console.error(e);
        res.send({status: -1, message: e});
    }
});

module.exports = router;
