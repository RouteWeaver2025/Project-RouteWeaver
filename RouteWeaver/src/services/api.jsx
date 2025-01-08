import axios from 'axios';

const fetchData = async () => {
  try {
    const response = await axios.get('/api'); // Vite proxies this to backend
    console.log(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

export default fetchData;
