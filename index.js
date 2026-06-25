require('dotenv').config()
const express = require('express');
const app = express();
const cors =require('cors');
const port = process.env.PORT;

const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
const uri =process.env.MONGO_URL



app.use(express.json());
app.use(cors());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


 const db = client.db("online-ticket-booking-platform");
 const vendorCollection = db.collection("vendor");
 const userCollection = db.collection("user");

 const bookingCollection = db.collection("bookings");




// app.post("/bookings/new", async(req,res)=>{
//     const booking = req.body;

//     const result = await bookingCollection.insertOne(booking);

//     res.send(result);
// });




// 📩 ১. ভেন্ডরের কাছে আসা সব বুকিং রিকোয়েস্ট গেট করার এপিআই
app.get('/vendor/requested-bookings', async (req, res) => {
  try {
    // রিয়াল প্রজেক্টে এখানে ভেন্ডরের ইমেইল দিয়ে ফিল্টার করতে পারেন, আপাতত সব বুকিং আনা হচ্ছে
    const result = await bookingCollection.find({ status: "pending" }).toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
});


// 🔄 ২. বুকিং এক্সেপ্ট বা রিজেক্ট করার এপিআই
app.patch('/vendor/bookings/status/:id', async (req, res) => {
  const id = req.params.id;
  const { action, ticketId, bookingQuantity } = req.body; // action: 'accepted' অথবা 'rejected'

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Booking ID format" });
  }

  try {
    // ক) যদি ভেন্ডর রিকোয়েস্ট ACCEPT করে
    if (action === 'accepted') {
      // প্রথমে টিকিট আইডি ভ্যালিড কিনা দেখে নিন
      if (!ObjectId.isValid(ticketId)) {
        return res.status(400).json({ message: "Invalid Ticket ID format" });
      }

      // বুকিং এক্সেপ্ট করার আগে মেইন টিকিট কালেকশন থেকে কোয়ান্টিটি কমিয়ে দিন ($inc: -quantity)
      const ticketUpdate = await vendorCollection.updateOne(
        { _id: new ObjectId(ticketId), quantity: { $gte: parseInt(bookingQuantity) } }, // স্টক যেন বুকিং পরিমাণের চেয়ে বেশি বা সমান থাকে
        { $inc: { quantity: -parseInt(bookingQuantity) } }
      );

      // যদি স্টক না থাকে বা টিকিটটি খুঁজে না পাওয়া যায়
      if (ticketUpdate.modifiedCount === 0) {
        return res.status(400).json({ success: false, message: "Failed to accept. Insufficient ticket stock!" });
      }
    }

    // খ) এবার বুকিং স্ট্যাটাস আপডেট করুন (Accept বা Reject যাই হোক না কেন)
    const result = await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: action } } // status হবে 'accepted' অথবা 'rejected'
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "Booking request not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: `Booking request successfully ${action === 'accepted' ? 'Accepted' : 'Rejected'}.` 
    });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});



// app.get('/bookings/:email', async (req, res) => {
//   const email = req.params.email;

//   const result = await bookingCollection.find({
//     userEmail: email
//   }).toArray();

//   res.send(result);
// });






 //post api
 app.post('/vendor/add-ticket',async (req,res)=>{
  const ticketData = req.body;
  try {
    const result = await vendorCollection.insertOne(ticketData);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json(error);
  }
})

   

//get api
app.get('/vendor/my-added-tickets',async (req,res)=>{
 try{
  const result = await vendorCollection.find({}).toArray();
  res.status (200).json(result);
 }catch(error){
  res.status(500).json(error);
 }
})



//get api 
app.get('/vendor/my-added-tickets/:id',async(req,res)=>{
  const id =req.params.id;
  try{
    const result =await vendorCollection.findOne({_id: new ObjectId(id)});
    res.status(200).json(result);
  }catch(error){
    res.status(500).json(error);
  }
})



//patch api for vendor ticket update

app.patch('/vendor/my-added-tickets/:id',async(req,res)=>{
  const id = req.params.id;
  const ticketData = req.body;
  try{
    const result = await vendorCollection.updateOne({_id: new ObjectId(id)},{$set: ticketData});
    res.status(200).json(result);
  }catch(error){
    res.status(500).json(error);
  }
})




//admin get api
app.get('/admin/all-tickets', async (req, res) => {
  try {
    const result = await vendorCollection.find().toArray(); // কালেকশনের সব ডেটা অ্যারে আকারে আসবে
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tickets", error: error.message });
  }
});


// একদম মিনিমাম কোড (ঝুঁকি আছে, তবে কাজ করবে)
app.patch('/admin/tickets/status/:id', async (req, res) => {
  try {
    const result = await vendorCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { verificationStatus: req.body.verificationStatus } }
    );
    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//advertisement api

// অ্যাডমিন নির্দিষ্ট টিকিট Advertise বা Unadvertise করার জন্য
app.patch('/admin/tickets/advertise/:id', async (req, res) => {
  const id = req.params.id;
  const { isAdvertised } = req.body; // ফ্রন্টএন্ড থেকে true অথবা false আসবে

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
    // ১. যদি ফ্রন্টএন্ড থেকে টিকিটটি Advertise (true) করতে বলা হয়
    if (isAdvertised === true) {
      // ডাটাবেজে অলরেডি কয়টি টিকিট advertised অবস্থায় আছে তা কাউন্ট করি
      const advertisedCount = await vendorCollection.countDocuments({ isAdvertised: true });
      
      // যদি অলরেডি ৬ বা তার বেশি থাকে, তবে নতুন করে করতে দেবো না
      if (advertisedCount >= 6) {
        return res.status(400).json({ 
          success: false, 
          message: "Limit reached! You cannot advertise more than 6 tickets at a time." 
        });
      }
    }

    // ২. লিমিট ঠিক থাকলে বা Unadvertise (false) করতে চাইলে ডাটাবেজ আপডেট করি
    const result = await vendorCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { isAdvertised: isAdvertised } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Ticket not found or status unchanged" });
    }

    res.status(200).json({ 
      success: true, 
      message: `Ticket successfully ${isAdvertised ? 'Advertised' : 'Unadvertised'}` 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});





//delete api
app.delete('/vendor/my-added-tickets/:id',async(req,res)=>{
  const id = req.params.id;
  try{
    const result = await vendorCollection.deleteOne({_id: new ObjectId(id)});
    res.status(200).json(result);
  
  }catch(error){
    res.status(500).json(error);
  }
})






// 👥 অ্যাডমিন কর্তৃক ইউজারের রোল বা ফ্রড স্ট্যাটাস আপডেট করার এপিআই
app.patch('/admin/users/role/:id', async (req, res) => {
  const id = req.params.id;
  const { role, isFraud } = req.body; // ফ্রন্টএন্ড থেকে role অথবা isFraud পাঠানো হবে

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
    // ডাইনামিকালি অবজেক্ট তৈরি করছি যা আপডেট করা হবে
    let updateFields = {};
    
    if (role) updateFields.role = role; // 'admin' অথবা 'vendor' অথবা 'user'
    if (isFraud !== undefined) updateFields.isFraud = isFraud; // true অথবা false

    const result = await userCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: "User status updated successfully!" 
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// সব ইউজারদের ডাটা নিয়ে আসার এপিআই (ইউজার লিস্ট টেবিল দেখানোর জন্য)
app.get('/admin/all-users', async (req, res) => {
  try {
    const result = await userCollection.find({}).toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});