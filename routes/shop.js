// 파일명 : routes/shop.js
var express = require('express');
var router = express.Router();

const db = require('mongodb').MongoClient;
const dburl = require('../config/mongodb').URL;
const dbname = require('../config/mongodb').DB;

const checkToken = require('../config/auth').checkToken;

const itemCount = 16;   // 한페이지에 보여줄 개수


// 주문 취소
// localhost:3000/shop/orderdelete
router.delete('/orderdelete', checkToken, async function(req, res, next) {
    try {
        const check = req.body.chk

        console.log('check---------->', check);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('order1');
        
        const result = await collection.deleteMany(
            { _id: {$in : check} }
        );
        console.log(result);
        if (result.deletedCount === check.length) {
            return res.send({status:200});
        }
    
        return res.send({status: 0});
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

// 주문 목록
// localhost:3000/shop/orderlist
router.get('/orderlist', checkToken, async function(req, res, next) {
    try {
        
        const email = req.body.uid; // 토큰을 활용

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('order1');  //주문한 상품이 들어있는 컬렉션
    
        
        const result = await collection.find(
            { orderid : email },    // 조건: 토큰이 들어있는 이메일
            { projection: { 
                    orderstep: 0,
                    orderid: 0,
                }
            }
        ).toArray();

        // 주문 목록 정보에 상품의 이름과 가격을 포함시켜야함
        const collection1 = dbconn.db(dbname).collection('item1');  // 상품이 들어있는 컬렉션

        for(let i=0; i<result.length; i++){
            
            const result1 = await collection1.findOne(
                { _id: result[i].itemcode },    //조건: 
                { projection: { 
                        name: 1,
                        price: 1
                    }
                }
            );

            result[i]['itemname'] = result1['name'];
            result[i]['itemprice'] = result1['price'];
        }
        
    
        return res.send({status:200, result:result});
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

// 시간대별 주문수량
// localhost:3000/shop/grouphour
router.get('/grouphour', async function(req, res, next) {
    try {
        
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('order1');
    
        const result = await collection.aggregate([
            
            {
                $project : {
                    orderdata   : 1,   // 주문일자
                    ordercnt    : 1,    // 주문수량
                    month       : {$month: '$orderdata'}, // 주문일자를 이용해서 달
                    hour        : {$hour: '$orderdata'},    // 주문일자를 이용해서 시
                    minute      : {$minute: '$orderdata'} // 주문일자를 이용해서 분
                }
            },
            {
                $group: {
                    _id     : '$minute',  // 그룹할 항목
                    count   : {
                        $sum : '$ordercnt'
                    }
                }
            }
        ]).toArray();
    
        return res.send({status:200, result:result});
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

// 상품별 주문수량
// localhost:3000/shop/groupitem
router.get('/groupitem', async function(req, res, next) {
    try {
        
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('order1');
    
        const result = await collection.aggregate([
            {
                $match: {
                    itemcode: 1085
                }
            },
            {
                $project : {    // 가져올 항목( 물품코드, 주문수량 )
                    itemcode: 1,
                    ordercnt: 1
                }
            },
            {
                $group: {
                    _id     : '$itemcode',
                    count   : {
                        $sum : '$ordercnt'
                    }
                }
            }            
        ]).toArray();
    
        return res.send({status:200, result:result});
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

// 주문하기
// localhost:3000/shop/order
// _id      : (PK) 주문번호 시퀀스 사용
// itemcode : (FK) 물품내역 (물품번호, 물품과 관련된 모든 정보)
// ordercnt : 주문수량
// orderdata: 주문일자
// orderid  : (FK) 주문자 (이메일, 고객과 관련된 모든 정보)
// orderstep: 0(카트), 1(주문), 2(결제), 3(배송중), 4(배송완료)

// 주문목록(조인)  : member1 + item1 + order1
// 로그인 사용자의 토큰, 물품번호, 주문수량
router.post('/order', checkToken, async function(req, res, next) {
    try {
        
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('sequence');

        const result = await collection.findOneAndUpdate(
            { _id:'SEQ_ORDER1_NO' },    // 가지고 오기 위한 조건
            { $inc: { seq:1 } }         // seq 값을 1 증가시킴
        );
        
        const obj = {
            _id: result.value.seq,  //주문번호
            itemcode    : Number(req.body.itemcode),    //물품번호
            ordercnt    : Number(req.body.ordercnt),    //주문수량
            orderid     : req.body.uid,  // 주문자(토큰에서)
            orderdata   : new Date(), //+ ( 1000 * 60 * 60 * 9 ), //9시간
            orderstep   : 1,
        }

        const collection1 = dbconn.db(dbname).collection('order1');
        const result1 = await collection1.insertOne(obj);

        if (result1.insertedId === obj._id) {
            return res.send({status:200});
        }
        return res.send({status:0});
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

// 상세화면 페이지
// localhost:3000/shop/selectone?code=1085
router.get('/selectone', async function(req, res, next) {
    try {
        
        const code = Number(req.query.code);

        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');
    
        // SQL문(INSERT, UPDATE, EDLETE, SELECT)
        // SQL문을 이용하여 DB연동 mybatis
        // SQL문을 저장소(함수)를 DB연동 jpa
        const result = await collection.findOne(
            { _id: code },
            { projection: { filedata:0, filetype:0, filename:0, filesize:0, regdate:0 }}
        );
        
        result['imageUrl'] = `/shop/image?code=${ code }`;
        
    
        return res.send({status:200, result:result});
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

// 메인페이지
// 판매순, 가격순, 할인률, 베스트
// localhost:3000/shop/select?page=1
router.get('/select', async function(req, res, next) {
try {
    const page = Number(req.query.page);

    const dbconn = await db.connect(dburl);
    const collection = dbconn.db(dbname).collection('item1');

    // SQL문(INSERT, UPDATE, EDLETE, SELECT)
    // SQL문을 이용하여 DB연동 mybatis
    // SQL문을 저장소(함수)를 DB연동 jpa
    const result = await collection.find(
        {},     // 조건없음 전체 가져오기
        {projection: { filedata:0, filetype:0, filename:0, filesize:0, regdate:0 }}
    )
    .sort( {_id: 1} )     // 정렬(물품코드를 오름차순으로)
    .skip( (page-1)*itemCount ) //  생략할 개수
    .limit( itemCount )
    .toArray();

    // for => [{},{},{}] => 위치를 i로 반복
    // for(let i=0;i<result.length;i++){
    //     result[i]['imageUrl'] = `/shop/image?code=${result[i]._id}`;
    // }

    // foreach => [{},{},{}] => 내용을 tmp로 반복
    for(let tmp of result){
        tmp['imageUrl'] = `/shop/image?code=${tmp._id}`;
    }

    return res.send({status:200, result:result});

} catch (e) {
    console.error(e);
    return res.send({status: -1, message:e});
}
    
});


// 이미지 가져오기
// localhost:3000/shop/image?code=1085
router.get('/image', async function(req, res, next) {
    try {
        const code = Number(req.query.code);
    
        const dbconn = await db.connect(dburl);
        const collection = dbconn.db(dbname).collection('item1');
    
        // SQL문(INSERT, UPDATE, EDLETE, SELECT)
        // SQL문을 이용하여 DB연동 mybatis
        // SQL문을 저장소(함수)를 DB연동 jpa
        const result = await collection.findOne(
            {_id: code },     // 조건없음 전체 가져오기
            {projection: { filedata:1, filetype:1, filename:1, filesize:1 }}
        )
    
        res.contentType(result.filetype);
        return res.send(result.filedata.buffer);
    
    } catch (e) {
        console.error(e);
        return res.send({status: -1, message:e});
    }
        
    });

module.exports = router;
