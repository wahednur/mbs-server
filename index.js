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
  origin: ["https://wsbms.netlify.app", "http://localhost:5173"],

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
    const agreementCollection = client.db("bms").collection("agreements");

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

    // Get all user for admin
    app.get("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const restult = await userCollection.find().toArray();
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

    //Member request
    app.patch("/member-request/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      // const user = await userCollection.findOne(query)
      const updateRole = {
        $set: {
          role: "pending",
        },
      };
      const result = await userCollection.updateOne(query, updateRole);
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
      const flatData = req.body;
      try {
        const { floor, flat, apartId } = flatData;
        const existing = await flatCollection.findOne({
          apartId: apartId,
          floor: parseInt(floor),
          "flat.flatNo": flat.flatNo,
        });
        if (existing) {
          return res
            .status(409)
            .json({
              message:
                "Flat already exists on this floor with the same flat number.",
            });
        }
        const result = await flatCollection.insertOne(flatData);
        res.send(result);
      } catch (error) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    // //Get flats
    // app.get("/flats", async (req, res) => {
    //   const result = await flatCollection.find().toArray();
    //   res.send(result);
    // });

    // GET flats with pagination
    app.get("/flats", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 6;
      const skip = (page - 1) * limit;

      const total = await flatCollection.countDocuments();
      const flats = await flatCollection
        .find()
        .skip(skip)
        .limit(limit)
        .toArray();

      res.send({
        flats,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    });

    // Get flats by admin
    // app.get("/flats/:email", verifyToken, verifyAdmin, async (req, res) => {
    //   const email = req.params.email;
    //   const query = { "apartment.user.email": email };
    //   const result = await flatCollection.find(query).toArray();
    //   res.send(result);
    // });
    app.get("/flats/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      try {
        const result = await flatCollection
          .aggregate([
            {
              $addFields: {
                apartIdObj: { $toObjectId: "$apartId" },
              },
            },
            {
              $lookup: {
                from: "apartments",
                localField: "apartIdObj",
                foreignField: "_id",
                as: "apartment",
              },
            },
            { $unwind: "$apartment" },
            {
              $match: {
                "apartment.user.email": email,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // Get single Flat
    // app.get("/flats-details/:id", async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   const result = await flatCollection.findOne(query);
    //   res.send(result);
    // });
    // Agrment flat
    const { ObjectId } = require("mongodb");

    app.get("/flats-details/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await flatCollection
          .aggregate([
            {
              $match: { _id: new ObjectId(id) },
            },
            {
              $addFields: {
                apartIdObj: { $toObjectId: "$apartId" },
              },
            },
            {
              $lookup: {
                from: "apartments",
                localField: "apartIdObj",
                foreignField: "_id",
                as: "apartment",
              },
            },
            {
              $unwind: "$apartment",
            },
          ])
          .toArray();

        res.send(result[0]);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    //Agreement
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

    //Coupon check
    app.get("/coupons/:code", async (req, res) => {
      const coupon = req.params.code;
      const query = { coupon: coupon }; // ✅ spelling ঠিক করা হলো

      const couponCheck = await couponCollection.findOne(query);
      console.log("Check", couponCheck);

      if (!couponCheck) {
        return res.status(404).json({ message: "Coupon not found" });
      }

      res.send(couponCheck);
    });

    // agreement request
    app.post("/agreement-request", async (req, res) => {
      const agreement = req.body;
      const result = await agreementCollection.insertOne(agreement);
      res.send(result);
    });
    //Payment
    app.post("/create-payment-intent", async (req, res) => {
      const data = req.body;
      console.log("Payment data", data);
      const { amount } = req.body;

      if (!amount) return res.status(400).json({ error: "Amount required" });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(amount * 100), // amount in cents
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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
