const { DateTime } = require('luxon');

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');

const app = express();
let socket;

const { initializeApp } = require('firebase-admin/app');

const cron = require('node-cron');
const {Server} = require('socket.io');
app.use(cors());

const server = http.createServer(app);
const io = new Server(server,{
  cors:{
    origin:"http://localhost:3001",
    methods:["GET","POST"],
  },
});

const port = 3000;



app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// app.use((req, res, next) => {
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
//   res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   next();
// });

const apiKey = 'ebfa6470fd5f4f5ddb47f7378aeb0ece'; // Replace with your actual API key
const exclude="minutely";
const units='metric'

// app.post('/subscribe', (req, res) => {
//   // Handle the subscription logic here
//   res.send('Subscribed to topic successfully');
// });

const thresholdTemperature=20;

const customizeNotification = (temperature) => {
  if (temperature=='Clouds') {
    return 'Looks like its a cloudy day today ';
  } else if(temperature=='Rain') {
    return 'Please take out your umbrella. It looks like there is a probability of rain today';}
    else if(temperature=='Clear')
    {
      return 'Clear weather today. Have a good day';
    }
    };
  

const fetchWeatherData = async () => {
  try {
    const city = 'Bangalore'; // Specify the city for which you want to fetch weather data
    const units = 'metric'; // Specify the temperature units
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`;
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;
    const formattedWeather = formatCurrentWeather(weatherData);
    

    return formattedWeather.detail;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error;
  }
};

//Schedule a cron job to fetch weather data daily
// cron.schedule('0 0 * * *', async () => {
//   try {
//     const temperature = await fetchWeatherData();
//     const notificationMessage = customizeNotification(temperature);
//     console.log(notificationMessage);
//     io.emit('notification', notificationMessage); // Emit the notification message to all connected clients
//   } catch (error) {
//     console.error('Error in cron job:', error);
//   }
// });

// Execute the task every 24 hours (86400000 milliseconds)
 // 24 hours in milliseconds
 setInterval(async () => {
  try {
    const temperature = await fetchWeatherData();
    console.log(temperature);
    const message = customizeNotification(temperature);
    console.log(message);
    io.emit('send-message',{ message,timestamp: new Date().toISOString()} );
  } catch (error) {
    console.error('Error:', error);
  }
}, 10000);

// Start the WebSocket server
io.on('connection', (clientSocket) => {
  console.log('New client connected');
  socket=clientSocket;
  // socket.on('disconnect', () => {
  //   console.log('Client disconnected');
  // });
  socket.on("notificationRequest",(data)=>
  {
    // socket.emit("send-message",{message:"HEELO BACK"});
  })


});



// Initialize the Firebase Admin SDK
// const serviceAccount = require('./notify.json');

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });



// app.get('/notification', async (req, res) => {
//   try {
//     const messaging = admin.messaging();

//     // Fetch weather data from the OpenWeather API
//     const {token,city, units} = req.query;
//     console.log(token);
//     const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`;
//     const respons = await axios.get(weatherUrl);
//     const weatherData = respons.data;
   
    

//     // Prepare the notification message
//     const notification = {
//       title: 'Daily Weather Update',
//       body: `Temperature in ${weatherData.name} is ${weatherData.temp}°C.`,
//     };

//     // Send the notification
//     const payload = {
//       notification: notification,
//       // Add any additional data fields if needed
//     };

//     const response = await messaging.sendToTopic('weather-updates', payload);
//     console.log('Notification sent:', response);

//     res.status(200).send('Notification sent');
//   } catch (error) {
//     console.error('Error sending notification:', error);
//     res.status(500).send('Error sending notification');
//   }
// });



const formatCurrentWeather = (data) => {
  const {
    coord: { lat, lon },
    main: { temp, humidity },
    name,
    dt,
    sys: { country },
    weather,
    wind: { speed },
  } = data;

  const { main: detail, icon } = weather[0];

  return { lat, lon, temp, humidity, name, dt, country, weather, detail, icon, speed };
};


const formatTimeZone=(secs,zone,format="cccc, dd LLLL")=>
DateTime.fromSeconds(secs).setZone(zone).toFormat(format);


const formatForNotification=(data)=>
{
    let{timezone,daily,hourly}=data;
    daily=(daily?? []).slice(1,6).map(d=>
    {
        return {
            
            date:d.dt,
            desc:d.weather[0].description
        }
    });
    return {daily}
  }

const formatForeCastWeather=(data)=>
{
    let{timezone,daily,hourly}=data;
    daily=(daily?? []).slice(1,6).map(d=>
    {
        return {
            title:formatTimeZone(d.dt,timezone,'LLL,dd'),
            temp:d.temp.day,
            icon:d.weather[0].icon
        }
    });

    
    
    hourly=(hourly?? []).slice(1,6).map(h=>
    {
        return {
            title:formatTimeZone(h.dt,timezone,'hh:mm'),
            temp:h.temp,
            icon:h.weather[0].icon
        }
    });

    return {daily,hourly,timezone}
}

app.get('/weather', async (req, res) => {
  try {
    const { city, units} = req.query;
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=${units}&appid=${apiKey}`;
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;
    const formattedWeather = formatCurrentWeather(weatherData);
    res.json(formattedWeather);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});


app.get('/forecast', async (req, res) => {
  try {
    const {lat,lon,units} = req.query;
    console.log(units);
    const weatherUrl = `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;
    const formattedForecastWeather = formatForeCastWeather(weatherData);
    console.log(formatForeCastWeather);
    res.json(formattedForecastWeather);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});


server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});




