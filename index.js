import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
env.config();

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "Forest clone ver 1",
    password: process.env.DB_PASSWORD,
    port: 5432,
  });
  db.connect();
  

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/",async (req,res) => {
    let query_data = await db.query("select * from tasks where status = 0;")
    let data_query = await db.query("select * from points;")
    let session_running = await db.query("select id from focus_session where time is null;")
    session_running = session_running.rows
    if (session_running.length > 0) {
        session_running = session_running[0].id
    }
    else {
        session_running = null;
    }
    
    let points_before = data_query.rows[0].points;
    let data = query_data.rows
    let tasks = [];
    let points = [];
    let ids = [];
    let times = [];
    for (let i = 0;i<data.length;i++) {
        tasks.push(data[i].task)
        points.push(data[i].points)
        ids.push(data[i].id);
        let query_data_2 = await db.query("select sum(time) from focus_session where id=$1;",[data[i].id])
        let focus_time = query_data_2.rows[0].sum
        let time = Math.floor(focus_time/(60))+":"+(focus_time-Math.floor(focus_time/(60))*60)
        times.push(time);
    }
    // console.log(times)
    res.render("index.ejs",{tasks: tasks,points: points,ids:ids,points_before:points_before,times:times,session_running:session_running});
})

app.get("/add",(req,res) => {
    res.render("add_task.ejs");
})

app.post("/add-task",async (req,res) => {
    await db.query("insert into tasks(task,points,status) values($1,$2,0);",[req.body.task,req.body.points]);
    res.redirect("/")
})

app.get("/modify/:id",async (req,res)=> {
    let query_data = await db.query("select * from tasks where id = $1",[req.params.id]);
    let data = query_data.rows[0]
    res.render("add_task.ejs",{flag: true, id: req.params.id,task: data.task,points: data.points})
})

app.post("/modify-task/:id",async (req,res)=> {
    await db.query("update tasks set task = $1, points = $2 where id = $3",[req.body.task,req.body.points,req.params.id]);
    res.redirect("/")
})

app.get("/delete/:id",async (req,res) => {
    await db.query("delete from tasks where id=$1;",[req.params.id]);
    await db.query("delete from focus_session where id = $1;",[req.params.id])
    res.redirect("/")
})

app.get("/complete/:id",async (req,res)=> {
    let data_query = await db.query("select * from points;")
    let points_before = data_query.rows[0].points;
    let data_query_2 = await db.query("select points from tasks where id = $1",[req.params.id]);
    let points_after = data_query_2.rows[0].points;
    await db.query("update points set points = $1;",[points_before+points_after]);
    await db.query("update tasks set status=1 where id=$1",[req.params.id]);
    res.redirect("/")
})

app.get("/start/:id",async (req,res) => {
    let date_obj = new Date();
    let date = date_obj.getDate() +"/"+ (date_obj.getMonth()+1) + "/" + date_obj.getFullYear()
    let time = date_obj.getHours() + ":" + date_obj.getMinutes();
    // console.log(date)
    // console.log(time)
    let data_query = await db.query("select * from focus_session where time is null;")
    let data = data_query.rows
    if (data.length == 0) {
        // console.log("No session is currently running")
        await db.query("insert into focus_session(id,start_time,start_date) values($1,$2,$3)",[req.params.id,time,date])
    }
    res.redirect("/")
})

app.get("/stop/:id",async (req,res)=> {
    let date_obj = new Date();
    let date = date_obj.getDate() +"/"+ (date_obj.getMonth()+1) + "/" + date_obj.getFullYear()
    let time = date_obj.getHours() + ":" + date_obj.getMinutes();
    // console.log(date)
    // console.log(time)
    let data_query = await db.query("select * from focus_session where time is null;")
    if (data_query.rows.length > 0) {
    // let data = data_query.rows[0].id;
        let start_date = data_query.rows[0].start_date
        let start_time = data_query.rows[0].start_time
        start_date = start_date.split("/")
        start_time = start_time.split(":")
        let date_obj_start = new Date(start_date[2],start_date[1]-1,start_date[0],start_time[0],start_time[1])
        let focus_time = date_obj - date_obj_start
        // console.log(Math.floor(focus_time/(60000*60))+":"+Math.round(focus_time/(60000)-Math.floor(focus_time/(60000*60))*60))
        let time_focused = Math.round(focus_time/(60000));
        await db.query("update focus_session set end_time=$1,end_date=$2,time=$3 where time is null;",[date,time,time_focused]);
        
    }
    res.redirect("/")
})

app.get("/stat", async (req,res) => {
    let date = new Date()
    let day = date.getDate();
    let month = date.getMonth()+1;
    let year = date.getFullYear()

    // console.log(day)
    // console.log("select sum(time) from focus_session where start_date = '"+day+"/"+month+"/"+year+"'")
    let data = await db.query("select sum(time) from focus_session where start_date = '"+day+"/"+month+"/"+year+"'");
    let time_today = data.rows[0].sum;
    let data2 = await db.query("select sum(time) from focus_session where start_date like '%/"+month+"/"+year+"';")
    let time_month = data2.rows[0].sum;
    time_today = Math.floor(time_today/(60))+":"+(time_today-Math.floor(time_today/(60))*60)
    time_month = Math.floor(time_month/(60))+":"+(time_month-Math.floor(time_month/(60))*60)
    res.render("statistics.ejs",{time_today:time_today,time_month:time_month});
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
