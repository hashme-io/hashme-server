var express = require('express');
var router = express.Router();
var debug = require('debug')('referral')

const { v4: uuidv4 } = require('uuid')

router.get('/', function(req, res, next) {
  res.send('list of referrals...');
});

// Grant & Retrieve Referral tokens for existing user

// usage:  GET '/grant?sponsor_id=N&expiry=2021-09-01'
//
// Required: 
//   sponsor_id (= user.id)
// Changes to DB: 
//    adds record to referrals table:
//      { token: <uuid>, sponsor_id: <user.id>, status: "pending" }

/**
 * @api {post} /grant Grant Referral code
 * @apiName Grant
 * @apiGroup Referrals
 *
 * 
 * @apiPermission member
 * 
 * @apiParam {sponsor_id} user_id of member generating referral code.
 * @apiParam {expiry} optional expiry date for token.
 *
 * @apiSuccess {token: referral_code, expiry: expiry} Token and expiry if applicable.
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "token": "*********", 
 *        "status": "pending", 
 *        "expiry": null
 *     }
 */
router.post(
  "/grant",
  auth,
  ah(async (req, res) => {
    const {sponsor_id, expiry} = req.body
    debug('grant token..')
    var token = uuidv4()
    debug('generated token: ' + token + ' sponsored by ' + sponsor_id)

    var ref = await db.Referral.create({
      sponsor_id: sponsor_id, 
      token: token, 
      status: 'pending'
    })

    debug('generated referral: ' + JSON.stringify(ref))
    return res.send({token: token, status: 'pending', expiry: expiry})
  })
);

/**
 * @api {get} /grant Grant Referral code (variation using get)
 * @apiName Grant
 * @apiGroup Referrals
 *
 * @apiPermission member
 * 
 * @apiPermission member
 * @apiParam {sponsor_id} user_id of member generating referral code.
 * @apiParam {expiry} optional expiry date for token.
 *
 * @apiSuccess {token: referral_code, status: status, expiry: expiry} Token and expiry if applicable.
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *        "token": "*********", 
 *        "status": "pending", 
 *        "expiry": null
 *     }
 */
router.get(
  "/grant",
  auth,
  ah(async (req, res) => {
    const {sponsor_id, expiry} = req.query
    debug('grant token..')
    var token = uuidv4()
    debug('generated token: ' + token + ' sponsored by ' + sponsor_id)

    var ref = await db.Referral.create({
      sponsor_id: sponsor_id, 
      token: token, 
      status: 'pending'
    })

    debug('generated referral: ' + JSON.stringify(ref))
    return res.send({token: token, status: 'pending', expiry: expiry})
  })
);


/**
 * @api {get} /checkTokens/:sponsor_id Retrieve list of referral tokens generated by this user
 * 
 * @apiName checkTokens
 * @apiGroup Referrals
 *
 *  
 * @apiPermission member
 * 
 * @apiParam {sponsor_id} user_id of member generating referral code.
 * @apiParam {status} optional token status.
 *
 * @apiSuccess tokens array of token objects 
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "tokens": [
 *         {"token": "*********", "status": "pending", "expiry": null}
 *       ]
 *     }
 */

// TO FIX - change sponsor_id so that it is retrieved from current payload (NOT FROM URL)

router.get(
  "/checkTokens/:sponsor_id",
  auth,
  ah(async (req, res) => {
    const {sponsor_id} = req.params

    var tokens = await db.Referral.findAll({
      // attributes: ['token', 'created_at', 'user_id', 'status'],
      include: [
        { model: db.User, as: 'user', attributes: ['username']}
      ],
      where: { sponsor_id: sponsor_id }
    })

    debug('my tokens: ' + JSON.stringify(tokens))
    return res.send({tokens: tokens})
  })
);


/**
 * @api {get} /verify/:user_id  Verify token and apply to existing user
 * 
 * @apiName verify
 * @apiGroup Referrals
 * 
 * @apiPermission member
 *  
 * @apiParam {user_id} Current user
 * @apiParam {token} Token to validate
 *
 * @apiSuccess verified = true
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "verified": true
 *     }
 * 
 * @apiDescription referral token is updated from 'pending' to 'active'
 * @apiDescription referral token is updated with existing user_id
 */
router.get(
  "/verify/:user_id/:token",
  auth,
  ah(async (req, res) => {
    const { user_id, token } = req.params;

    debug('verify token: ' + token)
      
    const found = await db.Referral.findAll({
      attributes: ['status'],
      where: {
        token: token,
        user_id: null
      }
    })

    if (found && found.length) {
      debug('found referral: ' + JSON.stringify(found))
      if (found[0].status === 'pending') {

        await db.Referral.update(
          { 
            status: 'active',
            user_id: user_id,
            updated_at: new Date().toISOString().substring(0,10)
          },
          {
            where: { token: token }
          }
        )

        return res.send({ verified: true });
      } else {
        res.status(500).send({ verified: false, message: 'Referral already ' + found[0].status })
      }
    } else {
      res.status(500).send('Invalid referral token')
    }
  })
);


/**
 * @api {post} /joinQueue  Join waiting list (track email & sms)
 * @apiName joinQueue
 * @apiGroup Referrals
 *
 * @apiParam {email} 
 * @apiParam {sms} 
 *
 * @apiSuccess verified = true
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "success": true
 *       "message": 'Added to waiting list'
 *     }
 * 
 * @apiDescription referral token is updated from 'pending' to 'active'
 * @apiDescription referral token is updated with existing user_id
 */
router.post(
  "/joinQueue",
  ah(async (req, res) => {
    const { email, sms } = req.query;

    debug('email: ' + email)
    debug('sms: ' + sms)

    await db.WaitingList.create({
      email: email,
      sms: sms    
    })

    res.send({success: true, message: 'Added to waiting list'})
  })
);

/**
 * @api {get} /isReferred/:user_id  Check if user is referred
 * @apiName isReferred
 * @apiGroup Referrals
 *
 * @apiParam {user_id} 
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       true
 *     }
 * 
 * @apiDescription returns boolean indicating if user is referred or not
 */
 router.get(
  "/isReferred/:user_id",
  ah(async (req, res) => {
    const { user_id } = req.params;

    var referred = await db.Referral.findOne({
      where: {
        user_id: user_id,
        status: 'active'
      }
    })
    
    if (referred) {
      res.send(true)
    } else {
      res.send(false)
    }
  })
 );

module.exports = router;
