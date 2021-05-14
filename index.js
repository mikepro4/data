const express = require("express");
const mongoose = require("mongoose");
const cookieSession = require("cookie-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const keys = require("./config/keys");
const PUBLIC_DIR = "public";
const STATIC_DIR = "static";
const timeout = require('connect-timeout')

mongoose.Promise = global.Promise;
const options = {
	 useNewUrlParser: true,
     poolSize: 1000
 }
mongoose.connect(keys.mongoURI, options,
    function(err){
        if(err){
            throw err
        }
});

const app = express();
app.use(timeout('15s'))
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cors());
app.use(
	cookieSession({
		maxAge: 30 * 24 * 60 * 60 * 1000,
		keys: [keys.cookieKey]
	})
);

app.use(express.static(STATIC_DIR));
app.use(express.static(PUBLIC_DIR));

app.get('/', function(req, res) {
  res.send({ message: 'Super secret code is ABC123' });
});

require("./models/Ticker");
require("./models/Proxy");
require("./models/ProxyLog");
require("./models/Video");
require("./models/VideoLog");
require("./models/Channel");
require("./models/ChannelLog");
require("./models/Group");
require("./models/Scraping");
require("./models/Connection");
require("./models/Notification");
require("./models/Post");
require("./models/Wall");

require("./routes/main")(app);

const PORT = process.env.PORT || 303;
const server = app.listen(PORT);

const io = require('socket.io')(server, {
	cors: {
	  origin: '*',
    },
    pingTimeout: 25000
})

io.on('connection',(socket)=>{
    socket.emit('rejectvideo',(data)=>{     
        return('reject from socket')
    })

})

// require("./scraping/") (io);
