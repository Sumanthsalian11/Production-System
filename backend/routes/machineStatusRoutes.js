const express = require("express");
const router = express.Router();
const MachineStatus = require("../models/MachineStatus");


/* =========================
   CREATE STATUS
========================= */

router.post("/", async (req, res) => {

try{

const { statusName } = req.body;

if(!statusName){
return res.status(400).json({message:"Status name required"});
}

const newStatus = new MachineStatus({
statusName,
});

const saved = await newStatus.save();

res.status(201).json(saved);

}catch(err){

if(err.code === 11000){
return res.status(400).json({message:"Status already exists"});
}

res.status(500).json({message:"Error creating status"});
}

});


/* =========================
   GET ALL STATUS
========================= */

router.get("/", async (req,res)=>{

try{

const statuses = await MachineStatus.find().sort({createdAt:-1});

res.json(statuses);

}catch(err){
res.status(500).json({message:"Error fetching status"});
}

});


/* =========================
   UPDATE STATUS
========================= */

router.put("/:id", async (req,res)=>{

try{

const updated = await MachineStatus.findByIdAndUpdate(
req.params.id,
req.body,
{new:true}
);

res.json(updated);

}catch(err){
res.status(500).json({message:"Error updating status"});
}

});


/* =========================
   DELETE STATUS
========================= */

router.delete("/:id", async (req,res)=>{

try{

await MachineStatus.findByIdAndDelete(req.params.id);

res.json({message:"Status deleted"});

}catch(err){
res.status(500).json({message:"Error deleting status"});
}

});

module.exports = router;