exports.resolveParticipants = (intentParticipants,groupMembers)=>{
    const resolved = [];
    for(const participant of intentParticipants){
        if (participant.toLowerCase() === "self") {
        continue;
        }
        const match = groupMembers.find((member)=>
        member.name.toLowerCase().includes(participant.toLowerCase()));

        if(match){
            resolved.push(match_id.toString());
        }
    }
    return resolved;
};