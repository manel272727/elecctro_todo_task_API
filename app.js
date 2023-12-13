const Hapi = require('@hapi/hapi');
const Joi = require('@hapi/joi');
const bcrypt = require('bcrypt');
const { Client } = require('pg');


const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'elecctrotodochallenge',
  password: '2727',
  port: 5432,
});

client.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Error connecting to PostgreSQL', err));

const init = async () => {
    const server = Hapi.server({
      port: 3001,
      host: 'localhost',
      routes: {
        cors: {
          origin: ['http://localhost:3000'], 
          credentials: true,
          additionalHeaders: ['Accept', 'Authorization', 'Content-Type'],
        },
      },
  });


  server.route({
    method: 'GET',
    path: '/api/data',
    handler: async (request, h) => {
      try {
        const { rows } = await client.query('SELECT * FROM todos');
        return rows;
      } catch (err) {
        return h.response('Error fetching data').code(500);
      }
    },
  });

  server.route({
    method: 'GET',
    path: '/api/userData',
    handler: async (request, h) => {
      try {
        const { rows } = await client.query('SELECT * FROM authentication');
        return rows;
      } catch (err) {
        return h.response('Error fetching data').code(500);
      }
    },
  });


  server.route({
    method: 'POST',
    path: '/api/todos',
    handler: async (request, h) => {
      try {
        const { payload } = request;
        const { todo_body } = payload; 

        if (!todo_body) {
          return h.response('Todo body is missing').code(400);
        }

        const result = await client.query('INSERT INTO todos (todo_body) VALUES ($1) RETURNING *', [todo_body]);

        if (result && result.rows && result.rows.length > 0) {
          return result.rows[0]; 
        } else {
          return h.response('Error inserting todo').code(500);
        }
      } catch (err) {
        console.error('Error inserting todo:', err);
        return h.response('Error inserting todo').code(500);
      }
    },
  });


  server.route({
    method: 'DELETE',
    path: '/api/todos/{id}', 
    handler: async (request, h) => {
      try {
        const { id } = request.params;

        const query = await client.query('DELETE FROM todos WHERE id = $1 RETURNING *', [id]);

        if (query && query.rows && query.rows.length > 0) {
          return query.rows[0]; // Return the deleted row
        } else {
          return h.response('Todo with specified ID not found').code(404);
        }
      } catch (err) {
        console.error('Error deleting todo:', err);
        return h.response('Error deleting todo').code(500);
      }
    },
  });


  server.route({
    method: 'PUT',
    path: '/api/todos/{id}', 
    handler: async (request, h) => {
      try {
        const { id } = request.params;
        const { todo_body, description } = request.payload;

        if (!todo_body) {
          return h.response('Todo body is missing').code(400);
        }

        const query = await client.query(
          'UPDATE todos SET todo_body = $1, description = $2 WHERE id = $3 RETURNING *',
          [todo_body, description, id]
        );

        if (query && query.rows && query.rows.length > 0) {
          return query.rows[0]; // Return the updated row
        } else {
          return h.response('Todo with specified ID not found').code(404);
        }
      } catch (err) {
        console.error('Error updating todo:', err);
        return h.response('Error updating todo').code(500);
      }
    },
  });


  server.route({
    method: 'PUT',
    path: '/api/todos/{id}/complete',
    handler: async (request, h) => {
      try {
        const { id } = request.params;
        const { complete } = request.payload;

        if (complete === undefined) {
          return h.response('Complete status is missing').code(400);
        }

        const currentDate = new Date(); 
        const query = await client.query('UPDATE todos SET complete = $1, finishedat = $2 WHERE id = $3 RETURNING *', [complete, currentDate, id]);

        if (query && query.rows && query.rows.length > 0) {
          return query.rows[0]; 
        } else {
          return h.response('Todo with specified ID not found').code(404);
        }
      } catch (err) {
        console.error('Error updating complete status:', err);
        return h.response('Error updating complete status').code(500);
      }
    },
  });


  const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });
    
  
  server.route({
    method: 'POST',
    path: '/api/register',
    handler: async (request, h) => {
      try {
        const { error, value } = registerSchema.validate(request.payload);

        if (error) {
          return h.response(error.details[0].message).code(400);
        }

        const { username, email, password } = value;

        const hashedPassword = await bcrypt.hash(password, 10);

        const checkUserQuery = await client.query('SELECT * FROM authentication WHERE username = $1 OR email = $2', [username, email]);
        if (checkUserQuery.rows.length > 0) {
          return h.response('Username or email already exists').code(400);
        }

        const insertUserQuery = await client.query('INSERT INTO authentication (username, email, password) VALUES ($1, $2, $3) RETURNING *', [username, email, hashedPassword]);

        if (insertUserQuery.rows && insertUserQuery.rows.length > 0) {
          return h.response('User registered successfully').code(201);
        } else {
          return h.response('Error registering user').code(500);
        }
      } catch (err) {
        console.error('Error registering user:', err);
        return h.response('Error registering user').code(500);
      }
    },
  });
    
  server.route({
    method: 'POST',
    path: '/api/login',
    handler: async (request, h) => {
      try {
        const { email, password } = request.payload;

        const userQuery = await client.query('SELECT * FROM authentication WHERE email = $1', [email]);

        if (userQuery.rows.length === 1) {
          const hashedPassword = userQuery.rows[0].password;
          console.log('Hashed Password from DB:', hashedPassword);

          const passwordMatch = await bcrypt.compare(password, hashedPassword);
          console.log('Password Match:', passwordMatch);

          if (passwordMatch) {
            return h.response('Login successful').code(200);
          } else {
            return h.response('Invalid credentials').code(401);
          }
        } else {
          return h.response('Invalid credentials').code(401);
        }
      } catch (err) {
        console.error('Error logging in:', err);
        return h.response('Error logging in').code(500);
      }
    },
  });


  server.route({
      method: 'DELETE',
      path: '/api/deleteAccount/{id}',
      handler: async (request, h) => {
        try {
          const { id } = request.params; 

          const deleteQuery = await client.query('DELETE FROM authentication WHERE id = $1', [id]);
    
          if (deleteQuery.rowCount > 0) {
            return h.response('Account deleted successfully').code(200);
          } else {
            return h.response('Account not found').code(404);
          }
        } catch (err) {
          console.error('Error deleting account:', err);
          return h.response('Error deleting account').code(500);
        }
      },
  });
    

    try {
      await server.start();
      console.log('Server running on %s', server.info.uri);
    } catch (err) {
      console.error('Error starting server:', err);
    }
  };

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection', err);
  process.exit(1);
});

init();