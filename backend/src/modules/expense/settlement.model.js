const mongoose = require("mongoose");
const settlementSchema = new mongoose.Schema(
    {
        groupId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Group",
            required:true
        },
        from:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true
        },
        to:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"User",
            required:true
        },
        amount:{
            type:Number,
            required:true
        }
    },
    {timestamps:true}
);
module.exports = mongoose.model("Settlement",settlementSchema);