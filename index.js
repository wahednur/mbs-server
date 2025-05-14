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
