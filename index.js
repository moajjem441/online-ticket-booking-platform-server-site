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

 //vendor api 


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