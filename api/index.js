const express = require('express')
const cors = require('cors')
const mongoose  = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('./models/User.js')
const Place = require('./models/Place.js')
const Booking = require('./models/Booking.js')
const cookieParser = require('cookie-parser')
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');

require('dotenv').config()
const app = express()

//const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = 'dsfhsdbgfvkjdgvbkghoeriuthrekvhbgbsj';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname+'/uploads'));
app.use(cors({
  credentials: true,
  origin: 'http://localhost:5173'
}));

mongoose.connect(process.env.MONGO_URL).then( () => {
  console.log('Database connection established');
})

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async(err, userData) => {
      if(err) throw err;
      resolve(userData);
    });
  });
}

app.get('/test' , (req , res) => {
  res.json('test ok')
})

app.post('/register' , async(req , res) => {
  try {
    const {name , email , password} = req.body;

    if(!name || !email || !password)  {
      return res.status(401).json({
        message: "Invalid data",
        success: false,
      })
    }

    const user = await User.findOne({email});

    if(user) {
      return res.status(401).json({
        message: "This user is already registered !",
        success: false,
      })
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const userDoc =  await User.create({
      name,
      email,
      password: hashedPassword,
    })

    return res.status(201).json({
      message: "User registered successfully !",
      success: true,
      userDoc,
    })

  } catch (error) {
    console.log(error);
  }
})


app.post('/login' , async(req , res) => {
  try {
    const {email, password} = req.body;

    if(!email || !password) {
      return res.status(401).json({
        message: "Invalid data",
        success: false
      })
    }

    const userDoc = await User.findOne({email});

    if(!userDoc) {
      res.status(404).json({
        message: "Invalid credentials",
        success: false
      })
    }

    const isMatch = await bcrypt.compare(password, userDoc.password);

    if(!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        success: false
      })
    }

    jwt.sign({email: userDoc.email, id: userDoc._id} , jwtSecret , {} , (err , token) => {
      if(err) throw err;
      res.cookie('token' , token).json(userDoc);
    })
 
  } catch (error) {
    console.log(error);
  }
})


app.post('/logout', (req, res) => {
  try {
    return res.status(200).cookie("token", "").json({
      message: "User logged out successfully !",
      success: true
    })
  } catch (error) {
    console.log(error);
  }
})


app.get('/profile' , (req , res) => {
  try {
    const {token} = req.cookies
    if(token) {
      jwt.verify(token, jwtSecret, {}, async(err, userData) => {
        if(err) throw err;
        const {name,email,_id} = await User.findById(userData.id)
        res.json({name,email,_id});
      })
    } else {
      res.json(null)
    }
  } catch (error) {
    console.log(error);
  }
})


app.post('/upload-by-link', async(req,res) => {
  try {
    const {link} = req.body;
    const newName = 'photo' + Date.now() + '.jpg'
    await imageDownloader.image({
      url: link,
      dest: __dirname + '/uploads/' + newName,
    })
    res.json(newName);
  } catch (error) {
    console.log(error);
  }
})

const photosMiddleware = multer({dest: 'uploads/'});
app.post('/upload' , photosMiddleware.array('photos',100), (req,res) => {
  try {
    const uploadedFiles = [];
    for(let i=0 ; i<req.files.length ; i++) {
      const {path,originalname} = req.files[i];
      const parts = originalname.split('.');
      const ext = parts[parts.length - 1]
      const newPath = path + '.' + ext;
      fs.renameSync(path, newPath);
      uploadedFiles.push(newPath.replace("uploads/" , ""));
    }
    res.json(uploadedFiles);
  } catch (error) {
    console.log(error);
  }
})

app.post('/places' , (req , res) => {
  try {
    const {token} = req.cookies;
    const {title, address, addedPhotos, description,
       perks, extraInfo, checkIn , checkOut, maxGuests, price} = req.body;
    jwt.verify(token, jwtSecret, {}, async(err, userData) => {
      if(err) throw err;
      const placeDoc = await Place.create({
        owner: userData.id,
        title, address, photos:addedPhotos, description,
       perks, extraInfo, checkIn , checkOut, maxGuests, price
      })
      res.json(placeDoc);
    })
  } catch (error) {
    console.log(error);
  }
})

app.get('/user-places', (req, res) => {
  const {token} = req.cookies;
  jwt.verify(token, jwtSecret, {}, async(err, userData) => {
    const {id} = userData;
    res.json(await Place.find({owner:id}))
  });
});

app.get('/places/:id' , async(req,res) => {
  const {id} = req.params;
  res.json(await Place.findById(id));
})

app.put('/places' , async(req, res) => {
  const {token} = req.cookies;
  const {
    id , title, address, addedPhotos, description,
    perks, extraInfo, checkIn , checkOut, maxGuests, price} = req.body;
  jwt.verify(token, jwtSecret, {}, async(err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if(userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title, address, photos:addedPhotos, description,
        perks, extraInfo, checkIn , checkOut, maxGuests, price
      });
      await placeDoc.save();
      res.json('ok');
    }
  })
})

app.get('/places' , async(req,res) => {
  res.json(await Place.find());
})

app.post('/bookings', async(req , res) => {
  const userData = await getUserDataFromReq(req)
  const {place,checkIn,checkOut,numberOfGuests,name,phone,price} = req.body;
  Booking.create({
    place,checkIn,checkOut,numberOfGuests,name,phone,price,user:userData.id
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  })
})

app.get('/bookings', async(req,res) => {
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({user:userData.id}).populate('place'))
})

app.listen(4000);

