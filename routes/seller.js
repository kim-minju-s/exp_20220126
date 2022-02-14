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

// 특정 폴더에 파일 첨부
// https://github.com/mongodb/node-mongodb-native
//CMD> npm i install multer --save
const multer = require('multer');
const upload = multer({storage: multer.memoryStorage()});


// 물품등록: 로그인, 이미지를 포함하여 n개
// localhost:3000/seller/insert
// 로그인을 한 사용자가 판매자
router.post('/insert', upload.array("image"), checkToken, async function(req, res, next) {
    try {
        // 전송1, body -> { key: [1, 2], key1:[3, 4] }
        // 전송1(1개 일 때), body -> { key: 1, key1: 3 }
        console.log(req.body);    // 물품명, 가격, 수량, 내용
        // 전송2, files -> [ { }, { } ]
        //console.log(req.files);   // 물품대표이미지
        // 최종, arr -> [{ }, { }]

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('sequence');

        const arr = [];
        for(let i=0; i<req.body.title.length; i++){
            const result = await collection.findOneAndUpdate(
                { _id:'SEQ_ITEM1_NO' },    // 가지고 오기 위한 조건
                { $inc: { seq:1 } }         // seq 값을 1 증가시킴
            );
            console.log(result);

            arr.push ({
                _id: result.value.seq,
                name: req.body.title[i],
                price: Number(req.body.price[i]),
                quantity: Number(req.body.quantity[i]),
                content: req.body.content[i],

                filename: req.files[i].originalname,
                filedata: req.files[i].buffer,
                filetype: req.files[i].mimetype,
                filesize: req.files[i].size,
                regdate: new Date(),

                seller : req.body.uid,  // checktoken에서 넣어줌
            });
        }
        console.log('arr', arr);

        const collection1   = dbconn.db(dbname).collection('item1');
        const result1       = await collection1.insertMany(arr);
        console.log(result1);   // { acknowledged, insertedCount, insertedids }

        if(req.body.title.length === result1.insertedCount){
            return res.send({status: 200});
        }
        return res.send({status: 0});

    } 
    catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
});

// 일괄삭제: 물품 번호
// localhost:3000/seller/delete
router.delete('/delete', checkToken, async function(req, res, next){
    try {
        // {"code":[1018,1019,1020]}
        // {"code":[1040]}
        const code = req.body.code;
        console.log(code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        // {$in: {1, 2, 3, 4} } 조건에 포함 된 항목
        const result = await collection.deleteMany(
            { _id: {$in : code} }
        );
        console.log(result);    //{ acknowledged: true, deletedCount: 3 }

        if (result.deletedCount === code.length) {
            return res.send({status: 200});
        }

        return res.send({status: 0});
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 물품일괄수정
// localhost:3000/seller/update
router.put('/update', upload.array("image"), checkToken, async function(req, res, next){
    try {
        // 2개이상 { code : [1016,1017], title : ['a','b'] }
        // 1개     { code :1016, title : 'a' }
        console.log(' ****************** ', req.body);  // code의 값이 문자 -> 숫자로 바꿔야함
        // 일괄 수정하기 위해서 필요한 정보 => 토큰
        
        // 1개 [ {} ] 
        // 2개 [ {},{} ]
        console.log(req.files);
        
        // DB 연결
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1'); // 물품이 들어있는 컬렉션 선택

        //req.body => { code: [1018,1019], title : ['a','b'] }
        //req.files => [{},{}]

        // req.body.title이 배열인가요? 2개 이상인가요?
        if ( Array.isArray(req.body.title)) {
            let cnt = 0;    // 실제적으로 변경한 개수를 누적할 변수
            for(let i=0; i<req.body.title.length; i++){
                
                let obj = {     // 변경할 내용: 4개의 키만
                    name: req.body.title[i],
                    price: Number(req.body.price[i]),
                    quantity: Number(req.body.quantity[i]),
                    content: req.body.content[i],
                };
                
                console.log('--------------------------',obj);
                // => { name: 'sdfe', price: '456465', quantity: '56', content: 'sadsee' }

                // 이미지를 첨부하면 4개 더 추가
                console.log('req.files=>', req.files); //[{},{},{}]

                if (typeof req.files[i] !== 'undefined') {
                    // 이미지 정보들을 obj 객체에 담는다
                    obj['filename'] = req.files[i].originalname;
                    obj.filedata = req.files[i].buffer;
                    obj['filetype'] = req.files[i].mimetype;
                    obj.filesize = Number(req.files[i].size);
                }
                console.log(typeof req.files[i]);

                const result = await collection.updateOne(
                    { _id: Number(req.body.code[i]) },
                    { $set : obj }
                );
                console.log('바뀐 물품 정보 =>', result);
                cnt += result.matchedCount;
            }

            console.log('바뀐 이미지 개수', cnt);

            // 실제 변경된 개수 === 처음 변경하기 위해 반복했던 개수 일치 유무
            if (cnt === req.body.title.length) {
                return res.send({status: 200});
            }
        }
        else{
            let obj = {     // 변경할 내용: 4개의 키만
                name        : req.body.title,
                price       : Number(req.body.price),
                quantity    : Number(req.body.quantity),
                content     : req.body.content,
            };

            if (typeof req.files[0] !== 'undefined') {
                // 이미지 정보들을 obj 객체에 담는다
                obj['filename'] = req.files[0].originalname;
                obj.filedata    = req.files[0].buffer;
                obj['filetype'] = req.files[0].mimetype;
                obj.filesize    = Number(req.files[0].size);
            };

            const result = await collection.updateOne(
                { _id: Number(req.body.code) },
                { $set : obj }
            );

            if (result.modifiedCount === 1) {
                return res.send({status: 200});
            }
        }

        return res.send({status: 0});
    }
    catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
});

// 1. 물품 1개 조회(물품코드가 전달되면)
// localhost:3000/seller/selectone?code=1040
router.get('/selectone', checkToken, async function(req, res, next){
    try {
        // 키가 uid 인 이유는 로그인 시에 토큰생성시 사용했던 키 정보
        const email = req.body.uid; // 토큰이 들어있는 uid(토큰의 길이 때문에 body를 씀) 
        const code = Number(req.query.code); // 조회할 물품의 code
        console.log(code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        // 조회하면 나오는 키정보 확인
        const result = await collection.findOne(
            { _id: code, seller: email }, // 조건
            { projection : { filedata:0, filename:0, filetype:0, filesize:0 } } // 이미지 데이터 안보이게
        );

        // 변수에 없는 키를 넣어야 추가됨. 있는 키는 변경됨.
        result['imageUrl'] = `/seller/image?code=${code}`;
        // result.imageUrl = `/seller/image?code=${code}`;

        console.log('-------result---------', result);

        // 서브이미지 정보가 필요함
        // 물품 1개를 조회할 대 서브 이미지의 정보를 전송하는 부분
        const collection1 = dbconn.db(dbname).collection('itemimg1');

        const result1 = await collection1.find(
            { itemcode: code }, // 조건
            { projection : { _id: 1 } }
        ).sort({_id:1}).toArray();
        console.log('-------result1-------', result1);

        // 수동으로 서브이미지 PK정보를 저장함.
        // result1 => [{"_id": 10006},{"_id": 10007},{"_id": 10008}]
        let arr1 = [];
        for(let i=0;i<result1.length;i++){
            arr1.push({
                imageUrl: `/seller/image1?code=${result1[i]._id}`
            });
        }
        result['subImage'] = arr1;
        console.log(result);

        return res.send({status: 200, result: result});
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 2. 물품전체 조회(판매자 토큰에 해당하는 것만)
// localhost:3000/seller/selectlist
router.get('/selectlist', checkToken, async function(req, res, next){
    try {
        // 키가 uid 인 이유는 로그인 시에 토큰생성시 사용했던 키 정보
        const email = req.body.uid;

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        // 조회하면 나오는 키정보 확인
        const result = await collection.find(
            { seller: email }, // 조건
            { projection : { filedata:0, filename:0, filetype:0, filesize:0 } }
        ).sort({_id: -1}).toArray();
        console.log('result -->', result);

        // [{},{},{},...{}]
        // 변수에 없는 키를 넣어야 추가됨. 있는 키는 변경됨.

        for(let i=0;i<result.length;i++){
            result[i]['imageUrl'] = 
                `/seller/image?code=${result[i]._id}&ts=${new Date().getTime()}`;
        }
        // result['imageUrl'] = `/seller/image?code=${code}`;
        // result.imageUrl = `/seller/image?code=${code}`;

        return res.send({status: 200, result: result});
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 3. 물품 이미지 표시(물품코드가 전달되면 이미지 표시)
// 대표 이미지를 가져옴, item1 컬렉션에서 가져옴(코드로 가져옴)
// localhost:3000/seller/image?code=1034
router.get('/image', async function(req, res, next){    // 토큰 필요없음
    try {
        const code = Number(req.query.code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        // 조회하면 나오는 키정보 확인
        const result = await collection.findOne(
            { _id : code }, // 조건
            { projection : { filedata:1, filename:1, filetype:1, filesize:1 } }
        );
        console.log('result -->', result);

        res.contentType(result.filetype);

        return res.send(result.filedata.buffer);
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 3. 서버이미지 표시
// 서브이미지를 가져옴, itemimg1 컬렉션에서 가져옴(코드로 가져옴)
// localhost:3000/seller/image1?code=1034
router.get('/image1', async function(req, res, next){   //토큰 필요없음
    try {
        const code = Number(req.query.code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('itemimg1');

        // 조회하면 나오는 키정보 확인
        const result = await collection.findOne(
            { _id : code }, // 조건
            { projection : { filedata:1, filename:1, filetype:1, filesize:1 } }
        );
        console.log('result -->', result);

        res.contentType(result.filetype);

        return res.send(result.filedata.buffer);
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// console.log(req);
// 조회 get => req.query => URL에 정보가 포함
// 추가 post => req.body => URL에 정보가 없으면
// 변경 put =>
// 삭제 delete => 

// 4. 물품번호 n개에 해당하는 항목 조회(물품코드 배열로 전달)
// localhost:3000/seller/selectcode?c=1040&c=1041
// { code : [1040, 1041] }
router.get('/selectcode', async function(req, res, next){
    try {
        // query 로 전달되는 값을 변수로 저장(타입이 문자임)
        let code = req.query.c;
        
        console.log(code); // code가 문자로 나옴

        // 반복문을 통해서 문자를 숫자로 변경(n개)
        for(let i=0;i<code.length;i++){
            code[i] = Number(code[i]);
        }

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        const result = await collection.find(
            { _id : { $in : code} }, // 조건
            { projection : { filedata:0, filename:0, filetype:0, filesize:0 } }
        ).sort({name:1}).toArray();

        for(let i=0;i<result.length;i++){
            result[i]['imageUrl'] = `/seller/image?code=${result[i]._id}`;
        }

        console.log(result);

        return res.send({ status: 200, result:result });
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 서브이미지 등록하기(n개)
// 물품에 따라서 개수가 다 다름
// 게시판 원본글(게시글 번호, 1) ----- (N)원본글에 다는 댓글(게시판 글번호)
// 물품(물품번호, 1) ----- (N)서브이미지(물품번호)
// localhost:3000/seller/subimage
router.post('/subimage', upload.array("image"), checkToken, async function(req, res, next) {
    try {
        const code = Number(req.body.code); // 원본 물품번호
        // arr -> [{ }, { }]
        console.log('req.files -->', req.files);
        
        // 시퀀스를 가져오기 위한 DB 연결
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('sequence');

        let arr = [];

        // 서브 이미지가 있는 원본 물품 가져오기
        for(let i=0;i<req.files.length;i++){
            const result = await collection.findOneAndUpdate(
                { _id:'SEQ_ITEMIMG1_NO' },    // 가지고 오기 위한 조건
                { $inc: { seq:1 } }         // seq 값을 1 증가시킴
            );

            arr.push({
                _id: result.value.seq,  // PK(기본키)
                filename: req.files[i].originalname,
                filedata: req.files[i].buffer,
                filetype: req.files[i].mimetype,
                filesize: req.files[i].size,
                itemcode: code, // FK(외래키) 물품코드
                idx     : (i+1),     // 서브이미지 순서
                regdate : new Date()
            })
        }

        // [{}, {}, {}] => insertMany(arr)
        const collection1   = dbconn.db(dbname).collection('itemimg1');
        const result1       = await collection1.insertMany(arr);
        console.log(result1);   // { acknowledged, insertedCount, insertedids }

        if(result1.insertedCount === req.files.length){
            return res.send({status: 200});
        }
        return res.send({status: 0});

    } 
    catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
});

module.exports = router;