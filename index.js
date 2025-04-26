require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;
const morgan = require("morgan");
// Declare the app
const app = express();

//Cors options
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
};
// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.send(`<h1>BMS is running on port ${port}</h1>`);
});

app.listen(port, () => {
  console.log(`BMS is running on port ${port}`);
});
