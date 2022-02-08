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
                price: req.body.price[i],
                quantity: req.body.quantity[i],
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
        // DB 연결
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        //req.body => { code: [1018,1019], title : ['a','b'] }
        //req.files => [{},{}]

        let cnt = 0;    // 실제적으로 변경한 개수를 누적할 변수
        for(let i=0; i<req.body.title.length; i++){
            
            let obj = {     // 4개의 키만
                code: req.body.code[i],
                name: req.body.title[i],
                price: req.body.price[i],
                quantity: req.body.quantity[i],
                content: req.body.content[i],
            };
            
            console.log(obj);
            // 이미지를 첨부하면 4개 더 추가
            if (typeof req.files[i] !== 'undefined') {
                obj['filename'] = req.files[i].originalname;
                obj['filedata'] = req.files[i].buffer;
                obj['filetype'] = req.files[i].mimetype;
                obj['filesize'] = req.files[i].size;
            }
            // console.log(typeof req.files[i]);
            const result = await collection.updateOne(
                { _id: req.body.code[i] },
                { $set : obj }
            );
            console.log(result);
            cnt += result.matchedCount;
        }

        // 실제 변경된 개수 === 처음 변경하기 위해 반복했던 개수 일치 유무
        if (cnt === req.body.title.length) {
            return res.send({status: 200});
        }

        return res.send({status: 0});
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 1. 물품 1개 조회(물품코드가 전달되면)
// localhost:3000/seller/selectone?code=1034
router.get('/selectone', checkToken, async function(req, res, next){
    try {
        const code = Number(req.body.code);
        console.log(code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');

        const result = await collection.findOne(
            { _id: {$in : code} }, // 조건
        );
        console.log(result);

        return res.send({status: 200});
    }
    catch (e) {
        return res.send({status: -1, message:e});
    }
});

// 2. 물품전체 조회(판매자 토큰에 해당하는 것만)
// localhost:3000/seller/selectlist

// 3. 물품 이미지 표시(물품코드가 전달되면 이미지 표시)
// localhost:3000/seller/image?code=1034

module.exports = router;