require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParsar = require("cookie-parser");
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const secrete = process.env.JWT_SECRETE;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// Declare the app
const app = express();

//Cors options
const corsOption = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOption));
app.use(express.json());
app.use(cookieParsar());
app.use(morgan("dev"));

const dbUser = process.env.MDB_USER;
const dbPass = process.env.MDB_PASS;

const uri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.w9uu7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    //Database collections
    const userCollection = client.db("bms").collection("users");
    const cityCollection = client.db("bms").collection("dhaka");
    const apartmentCollection = client.db("bms").collection("apartments");
    const flatCollection = client.db("bms").collection("flats");
    const couponCollection = client.db("bms").collection("coupons");

    //Verify token middleware
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, secrete, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Forbidden Access" });
        }
        req.decoded = decoded;
        next();
      });
    };
    //Verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Unauthorize access" });
      }
      next();
    };
    //Jwt token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, secrete, { expiresIn: "1h" });
      res.send({ token });
    });
    //Ceate User
    app.post("/users", async (req, res) => {
      const { email } = req.body;
      const user = req.body;
      const query = { email: email };
      const newUser = { ...user, role: "user" };
      if (!email) return res.send({ message: "You email missing" });
      const isExist = await userCollection.findOne(query);
      if (isExist) {
        return res.send(isExist);
      }
      const restult = await userCollection.insertOne(newUser);
      res.send(restult);
    });

    // Get User roles
    app.get("/user-role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const role = user?.role;
      res.send(role);
    });

    //Get cities data
    app.get("/cities", async (req, res) => {
      const cities = await cityCollection.find().toArray();
      res.send(cities);
    });

    //Add apartment
    app.post(
      "/apartments/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const appertment = req.body;
        const newApp = { ...appertment, availableFlat: appertment.flatQty };
        const result = await apartmentCollection.insertOne(newApp);
        res.send(result);
      }
    );

    app.get(
      "/apartments/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { "user.email": email };
        const result = await apartmentCollection.find(query).toArray();
        res.send(result);
      }
    );
    //get Appetment for add flat
    app.get("/apartments", async (req, res) => {
      const retult = await apartmentCollection.find().toArray();
      res.send(retult);
    });

    //Add flat

    app.post("/flats/:email", verifyToken, verifyAdmin, async (req, res) => {
      const newFlat = req.body;
      const result = await flatCollection.insertOne(newFlat);
      res.send(result);
    });
    //Get flats
    app.get("/flats", async (req, res) => {
      const result = await flatCollection.find().toArray();
      res.send(result);
    });

    // Get flats by admin
    app.get("/flats/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { "apartment.user.email": email };
      const reslt = await flatCollection.find(query).toArray();
      res.send(reslt);
    });

    // Get single Flat
    app.get("/flats/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await flatCollection.findOne(query);
      res.send(result);
    });
    //get Signle apartment
    app.get("/apartment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await apartmentCollection.findOne(query);
      res.send(result);
    });

    //Seaching
    app.get("/searching", async (req, res) => {
      const { min, max } = req.query;
      const minPrice = parseInt(min) || 0;
      const maxPrice = parseInt(max) || 10000000;
      const search = { $gte: min, $lte: max };

      const result = await flatCollection.find({ rent: search }).toArray();
      res.send(result);
    });

    //Coupon
    app.post("/coupon/:email", verifyToken, verifyAdmin, async (req, res) => {
      const coupon = req.body;
      if (coupon.coupon) {
        coupon.coupon = coupon.coupon.toUpperCase();
      }
      const result = await couponCollection.insertOne(coupon);
      res.send(result);
    });

    app.get("/coupons", verifyToken, verifyAdmin, async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });
    app.get("/coupons-pup", async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`<h1>BMS is running on port ${port}</h1>`);
});

app.listen(port, () => {
  console.log(`BMS is running on port ${port}`);
});
