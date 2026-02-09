const dotenv = require('dotenv');
const mongoose = require('mongoose');

const app = require('./app');

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected.');
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed.', err);
    process.exit(1);
  });


  mongoose.connection.once('open', () => {
  console.log('Connected to DB:', mongoose.connection.name);
});
