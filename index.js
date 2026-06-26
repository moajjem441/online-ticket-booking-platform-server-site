require('dotenv').config()
const express = require('express');
const app = express();
const cors =require('cors');
const port = process.env.PORT;

const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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


// -----------------jwt---------------

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)


const verifyToken =async (req,res,next)=>{
  const authHeader=req?.headers.authorization
  if(!authHeader){
    return res.status(401).json({message:"Unauthorized"})
  }
  const token = authHeader.split(" ")[1]

  if(!token){
    return res.status(401).json({message:"Unauthorized"})
  }
  console.log(token)



  try{
    const {payload}=await jwtVerify(token,JWKS)

  console.log(payload)

   next()
  }catch(error){
    return res.status(403).json({message:
      "Forbidden"
    });
  }
 
}






async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    //deploy korar somoy eta comment out korbo
    await client.connect();


 const db = client.db("online-ticket-booking-platform");
 const vendorCollection = db.collection("vendor");
 const userCollection = db.collection("user");

 const bookingCollection = db.collection("bookings");




app.post("/bookings/new", async(req,res)=>{
    const booking = req.body;

    const result = await bookingCollection.insertOne(booking);

    res.send(result);
});




app.patch("/bookings/update-status/:id", async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { status } = req.body; 

     
        if (!ObjectId.isValid(bookingId)) {
            console.error(" Invalid Booking ID format:", bookingId);
            return res.status(400).send({ error: "Invalid Booking ID format" });
        }

    
        const booking = await bookingCollection.findOne({ _id: new ObjectId(bookingId) });
        
        if (!booking) {
            console.error(" Booking not found for ID:", bookingId);
            return res.status(404).send({ error: "Booking not found" });
        }

        
        if (booking.status === 'paid') {
            return res.send({ message: "Already paid", modifiedCount: 0 });
        }

        
        const updateBookingResult = await bookingCollection.updateOne(
            { _id: new ObjectId(bookingId) },
            { $set: { status: status || 'paid' } }
        );

       
        if ((status?.toLowerCase() === 'paid' || !status) && booking.ticketId) {
            
            
            const quantityToReduce = -Number(booking.bookingQuantity || 1);

      
            await vendorCollection.updateOne(
                { _id: new ObjectId(booking.ticketId) }, 
                { $inc: { quantity: quantityToReduce } } 
            );
            console.log(` Ticket stock reduced by: ${booking.bookingQuantity}`);
        }

        console.log(` Booking ${bookingId} successfully marked as PAID.`);
        res.send(updateBookingResult);

    } catch (error) {
        console.error(" Error inside PATCH /bookings/update-status:", error);
        res.status(500).send({ error: "Internal Server Error", details: error.message });
    }
});


app.get('/bookings/:email', async (req, res) => {
  const email = req.params.email;

  const result = await bookingCollection.find({
    userEmail: email
  }).toArray();

  res.send(result);
});





app.get('/transactions/:email', async (req, res) => {
  try {
    const email = req.params.email;

   
    const result = await bookingCollection.find({
      userEmail: email,
      status: "paid"
    }).toArray();

    res.status(200).json(result);
  } catch (error) {
    console.error(" Error fetching transaction history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});





app.get("/vendor/revenue-stats", async (req, res) => {
  try {
    
    const allBookings = await db.collection("bookings").find({}).toArray();
    
  
    const totalAdded = allBookings.length; 

    let totalSold = 0;
    let totalRevenue = 0;

  
    const dailyDataMap = {};

    allBookings.forEach((booking) => {
      const qty = Number(booking.bookingQuantity) || 0;
      const price = Number(booking.totalPrice) || (Number(booking.unitPrice) * qty);

   
      if (booking.status === "paid") {
        totalSold += qty;
        totalRevenue += price;
      }

     
      if (booking.departureDate) {
        
        const dateObj = new Date(booking.departureDate);
        const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "2-digit" });

        if (!dailyDataMap[formattedDate]) {
          dailyDataMap[formattedDate] = { name: formattedDate, Added: 0, Sold: 0, Revenue: 0 };
        }

       
        dailyDataMap[formattedDate].Added += 1;

   
        if (booking.status === "paid") {
          dailyDataMap[formattedDate].Sold += qty;
          dailyDataMap[formattedDate].Revenue += price;
        }
      }
    });

    const chartData = Object.values(dailyDataMap).sort((a, b) => new Date(a.name) - new Date(b.name));

   
    res.status(200).json({
      totalAdded: totalAdded,     
      totalSold: totalSold,       
      totalRevenue: totalRevenue, 
      chartData: chartData.length > 0 ? chartData : [
        { name: 'No Data', Added: 0, Sold: 0, Revenue: 0 }
      ]
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Internal server error in analytics" });
  }
});







app.get('/vendor/requested-bookings', async (req, res) => {
  try {

    const result = await bookingCollection.find({ status: "pending" }).toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch bookings", error: error.message });
  }
});



app.patch('/vendor/bookings/status/:id', async (req, res) => {
  const id = req.params.id;
  const { action, ticketId, bookingQuantity } = req.body; 

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid Booking ID format" });
  }

  try {
   
    if (action === 'accepted') {
  
      if (!ObjectId.isValid(ticketId)) {
        return res.status(400).json({ message: "Invalid Ticket ID format" });
      }

  
      const ticketUpdate = await vendorCollection.updateOne(
        { _id: new ObjectId(ticketId), quantity: { $gte: parseInt(bookingQuantity) } }, 
        { $inc: { quantity: -parseInt(bookingQuantity) } }
      );

     
      if (ticketUpdate.modifiedCount === 0) {
        return res.status(400).json({ success: false, message: "Failed to accept. Insufficient ticket stock!" });
      }
    }

   
    const result = await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: action } } 
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
app.get('/admin/all-tickets', verifyToken, async (req, res) => {
  try {
    const result = await vendorCollection.find().toArray(); 
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tickets", error: error.message });
  }
});


app.get('/all-tickets',  async (req, res) => {
  try {
    const result = await vendorCollection.find().toArray(); 
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tickets", error: error.message });
  }
});






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


app.patch('/admin/tickets/advertise/:id', async (req, res) => {
  const id = req.params.id;
  const { isAdvertised } = req.body; 

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
   
    if (isAdvertised === true) {
      
      const advertisedCount = await vendorCollection.countDocuments({ isAdvertised: true });
      
      
      if (advertisedCount >= 6) {
        return res.status(400).json({ 
          success: false, 
          message: "Limit reached! You cannot advertise more than 6 tickets at a time." 
        });
      }
    }

    
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







app.patch('/admin/users/role/:id', async (req, res) => {
  const id = req.params.id;
  const { role, isFraud } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  try {
  
    let updateFields = {};
    
    if (role) updateFields.role = role; 
    if (isFraud !== undefined) updateFields.isFraud = isFraud;

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


app.get('/admin/all-users', async (req, res) => {
  try {
    const result = await userCollection.find({}).toArray();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});






    // Send a ping to confirm a successful connection

    //deploy korar somoy eta comment out korbo
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