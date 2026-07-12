const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

require("dotenv").config();
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Hello World!");
});
console.log("🚀 SERVER STARTED");
// mongodb connection

const uri = process.env.MONGO_DB_URI;

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
    await client.connect();

    const database = client.db(process.env.AUTH_DB_NAME);
    const jobCollection = database.collection("jobs");
    const companyCollection = database.collection("companies");
    const userCollection = database.collection("user");
    const applicationCollection = database.collection("application");
    const planCollection = database.collection("plans");
    const subscriptionCollection = database.collection("subscription");
    const sessionCollection = database.collection("session");

    const logger = (req, res, next) => {
      console.log(`logger middleware loged`, req.params);
      next();
    };

    const verifytoken = async (req, res, next) => {
      console.log(req.headers.authorization);

      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).send({
          message: "Unauthorized",
        });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({
          message: "Unauthorized access",
        });
      }
      const query = { token: token };
      
      const session = await sessionCollection.findOne(query);
      
     if (!session) {
  return res.status(401).send({
    message: "Unauthorized access",
  });
}
      const userId = session.userId;
const userQuery = {
  _id: userId,
};

const user = await userCollection.findOne(userQuery);  

if (!user) {
  return res.status(401).send({
    message: "Unauthorized access",
  });
}

req.user = user;

console.log("Logged User:", user);

next();
};
    const verifySeeker = async (req, res, next) => {
      if (req.user?.role !== "seeker") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

 
      const verifyAdmin = async (req, res, next) => {
            if (req.user.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }
    // subscription

    app.post("/api/subscription", async (req, res) => {
      const data = req.body;
      const subsInfo = {
        ...data,
        createdAt: new Date(),
      };
      const result = await subscriptionCollection.insertOne(subsInfo);

      // update the user plan information

      const filter = { email: data.email };

      const updateDocument = {
        $set: {
          plan: data.planId,
        },
      };
      const updateResult = await userCollection.updateOne(
        filter,
        updateDocument,
      );
      res.send(updateResult);
    });

    // plans
    app.get("/api/plans", async (req, res) => {
      const query = {};
      if (req.query.plan_id) {
        query.plan_id = req.query.plan_id;
      }
      const plan = await planCollection.findOne(query);
      res.send(plan);
    });

    app.get("/api/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result || {});
    });

    // application related apis
app.get(
  "/api/applications",
  verifytoken,
  verifySeeker,
  async (req, res) => {
    const query = {};

    if (req.query.applicantId) {

      if (req.user._id.toString() !== req.query.applicantId) {
        return res.status(403).send({
          message: "Forbidden"
        });
      }

      query.applicantId = req.query.applicantId;
    }

    if (req.query.jobId) {
      query.jobId = req.query.jobId;
    }

    const result = await applicationCollection.find(query).toArray();

    res.send(result);
  }
);

    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        createdAt: new Date(),
      };
      const result = await applicationCollection.insertOne(newApplication);
      res.send(result);
    });

    // application

    app.get("/api/jobs", async (req, res) => {
  const query = {};

if (req.query.search) {
  query.$or = [
    { jobTitle: { $regex: req.query.search, $options: "i" } },
    { companyName: { $regex: req.query.search, $options: "i" } },
  ];
}

  if (req.query.jobType && req.query.jobType !== "all") {
  query.jobType = req.query.jobType;
}

  if (req.query.jobCategory && req.query.jobCategory !== "all") {
  query.jobCategory = req.query.jobCategory;
}

if (req.query.isRemote === "true") {
  query.isRemote = true;
}
 if (req.query.page) {
       const page = Number(req.query.page) || 1;
const perPage = Number(req.query.perPage) || 12;

const skipItems = (page - 1) * perPage;

        const total = await jobCollection.countDocuments(query);
        const cursor = jobCollection.find(query).skip(skipItems).limit(perPage);
        const jobs = await cursor.toArray();
        return res.send({ total, jobs });
    }

    const cursor = jobCollection.find(query);
    const result = await cursor.toArray();
    res.send(result);
}
 


  
);

    app.get("/api/jobs/:id", async (req, res) => {
      try {
        const id = req.params.id;

        console.log("Job ID:", id);

        const result = await jobCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).send({
          message: error.message,
        });
      }
    });
    app.post("/api/jobs", async (req, res) => {
      const job = req.body;
      const newJob = {
        ...job,
        createdAt: new Date(),
      };
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    // company related api
    app.post("/api/companies", async (req, res) => {
      const company = req.body;
      const newCompany = {
        ...company,
        createdAt: new Date(),
      };
      const result = await companyCollection.insertOne(newCompany);
      res.send(result);
    });

    app.get("/api/companies", logger, verifytoken,verifyAdmin, async (req, res) => {
      const result = await companyCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/my/companies", async (req, res) => {
      console.log("QUERY:", req.query.recuiterId);

      const companies = await companyCollection.find().toArray();
      console.log("ALL:", companies);

      const result = await companyCollection.findOne({
        recuiterId: req.query.recuiterId,
      });

      console.log("FOUND:", result);

      res.json(result || {});
    });

    // update

    app.patch("/api/companies/:id", logger, verifytoken, async (req, res) => {
      const id = req.params.id;
      const updatedCompany = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: updatedCompany.status,
        },
      };
      const result = await companyCollection.updateOne(filter, updatedDoc);
      console.log("RESULT:", result);
      res.json(result || {});
    });

    await client.db(process.env.AUTH_DB_NAME).command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  } 
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});

module.exports = app