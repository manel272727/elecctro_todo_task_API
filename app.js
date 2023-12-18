const Hapi = require('@hapi/hapi');
const Joi = require('joi');
const bcrypt = require('bcrypt');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const HapiSwagger = require('hapi-swagger');
const { Client } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');



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





// GET TODOS INFO - GET REQUEST
  server.route({
    method: 'GET',
    path: '/api/data',
    options: {
      tags: ['api'], 
      description: 'Get data from todos table',
      handler: async (request, h) => {
        try {
          const { rows } = await client.query('SELECT * FROM todos');
          return rows;
        } catch (err) {
          return h.response('Error fetching data').code(500);
        }
      },
    },
  });
  

// GET USERS INFO - GET REQUEST
  server.route({
    method: 'GET',
    path: '/api/userData',
    options: {
      tags: ['api'],
      description: 'Fetch user data from the authentication table',
      handler: async (request, h) => {
        try {
          const { rows } = await client.query('SELECT * FROM authentication');
          return rows;
        } catch (err) {
          console.error('Error fetching user data:', err);
          return h.response('Error fetching data').code(500);
        }
      },
    },
  });
  
  


 //ADD NEW TODO - POST REQUEST
  const todoSchema = Joi.object({
    todo_body: Joi.string().required().description('The body of the todo'),
  });
  
  server.route({
    method: 'POST',
    path: '/api/todos',
    options: {
      tags: ['api'],
      description: 'Add a new todo to the database',
      validate: {
        payload: todoSchema,
      },
      handler: async (request, h) => {
        try {
          const { payload } = request;
          const { todo_body } = payload;
  
          const result = await client.query('INSERT INTO todos (todo_body) VALUES ($1) RETURNING *', [todo_body]);
  
          if (result && result.rows && result.rows.length > 0) {
            return result.rows[0];
          } else {
            return h.response('Error adding todo').code(500);
          }
        } catch (err) {
          return h.response('Error adding todo').code(500);
        }
      },
    },
  });
  

// DELETE TODOS - DELETE REQUEST
  server.route({
    method: 'DELETE',
    path: '/api/todos/{id}',
    options: {
      tags: ['api'],
      description: 'Delete a todo from database',
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required().description('The ID of the todo to delete'),
        }),
      },
      handler: async (request, h) => {
        try {
          const { id } = request.params;
  
          const query = await client.query('DELETE FROM todos WHERE id = $1 RETURNING *', [id]);
  
          if (query && query.rows && query.rows.length > 0) {
            return query.rows[0]; 
          } else {
            return h.response('Todo not found').code(404);
          }
        } catch (err) {
          console.error('Error deleting todo:', err);
          return h.response('Error deleting todo').code(500);
        }
      },
    },
  });
  

// EDIT TODOS INFO - PATCH REQUEST
  const todoUpdateSchema = Joi.object({
    todo_body: Joi.string().required().description('The edited todo'),
    description: Joi.string().description('The edited todo description'),
  });
  
  server.route({
    method: 'PATCH',
    path: '/api/todos/{id}',
    options: {
      tags: ['api'],
      description: 'Partially update a todo by ID',
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required().description('The ID of the todo to update'),
        }),
        payload: todoUpdateSchema,
      }, 
      handler: async (request, h) => {
        try {
          const { id } = request.params;
          const { todo_body, description } = request.payload;
  
          if (!todo_body && !description) {
            return h.response('Todo body or description is missing').code(400);
          }
  
          const updateFields = [];
          const queryParams = [];
          if (todo_body) {
            updateFields.push('todo_body = $1');
            queryParams.push(todo_body);
          }
          if (description) {
            updateFields.push('description = $2');
            queryParams.push(description);
          }
          queryParams.push(id); 
  
          const updateQuery = await client.query(
            `UPDATE todos SET ${updateFields.join(', ')} WHERE id = $${queryParams.length} RETURNING *`,
            queryParams
          );
  
          if (updateQuery && updateQuery.rows && updateQuery.rows.length > 0) {
            return updateQuery.rows[0]; 
          } else {
            return h.response('Todo with specified ID not found').code(404);
          }
        } catch (err) {
          console.error('Error updating todo:', err);
          return h.response('Error updating todo').code(500);
        }
      },
    },
  });
  


  // TODOS COMPLETE - PATCH REQUEST
  server.route({
    method: 'PATCH',
    path: '/api/todos/{id}/complete',
    options: {
      tags: ['api'],
      description: 'Update the completion status of a todo by ID',
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required().description('The ID of the todo to update completion status'),
        }),
        payload: Joi.object({
          complete: Joi.boolean().required().description('Status indicating if the todo is complete or not'),
        }),
      },
      handler: async (request, h) => {
        try {
          const { id } = request.params;
          const { complete } = request.payload;
  
          if (complete === undefined) {
            return h.response('Complete status is missing').code(400);
          }
  
          const currentDate = new Date();
          const updateFields = ['complete = $1'];
          const queryParams = [complete];
  
          if (complete) {
            updateFields.push('finishedat = $2');
            queryParams.push(currentDate);
          }
  
          queryParams.push(id); 
  
          const query = await client.query(
            `UPDATE todos SET ${updateFields.join(', ')} WHERE id = $${queryParams.length} RETURNING *`,
            queryParams
          );
  
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
    },
  });
  

  //ADD NEW USER, REGISTER - POST REQUEST
  const registerSchema = Joi.object({
    username: Joi.string().required().description('The username for registration'),
    email: Joi.string().email().required().description('The email for registration'),
    password: Joi.string().required().description('The password for registration'),
  });

  server.route({
    method: 'POST',
    path: '/api/register',
    options: {
      tags: ['api'],
      description: 'Register a new user',
      validate: {
        payload: registerSchema,
      },
      handler: async (request, h) => {
        try {
          const { error, value } = registerSchema.validate(request.payload);
  
          if (error) {
            return h.response(error.details[0].message).code(400);
          }
  
          const { username, email, password } = value;
  
          const hashedPassword = await bcrypt.hash(password, 10);
  
          const checkUserQuery = await client.query('SELECT * FROM authentication WHERE username = $1 OR email = $2', [
            username,
            email,
          ]);
  
          if (checkUserQuery.rows.length > 0) {
            return h.response('Username or email already exists').code(400);
          }
  
          const insertUserQuery = await client.query(
            'INSERT INTO authentication (username, email, password) VALUES ($1, $2, $3) RETURNING *',
            [username, email, hashedPassword]
          );
  
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
    },
  });
    

  //ENTER IN EXISTING ACCOUNT, LOGIN - POST REQUEST
  const loginSchema = Joi.object({
    email: Joi.string().email().required().description('The email for login'),
    password: Joi.string().required().description('The password for login'),
  });

  const secretKey = crypto.randomBytes(32).toString('hex');
  const JWT_SECRET_KEY = secretKey; 

server.route({
  method: 'POST',
  path: '/api/login',
  options: {
    tags: ['api'],
    description: 'Login',
    validate: {
      payload: Joi.object({
        email: Joi.string().email().required().description('Email for login'),
        password: Joi.string().required().description('Password for login'),
      }),
    },
    handler: async (request, h) => {
      try {
        const { email, password } = request.payload;

        const userQuery = await client.query('SELECT * FROM authentication WHERE email = $1', [email]);

        if (userQuery.rows.length === 1) {
          const hashedPassword = userQuery.rows[0].password;

          const passwordMatch = await bcrypt.compare(password, hashedPassword);

          if (passwordMatch) {
            const token = jwt.sign({ email }, JWT_SECRET_KEY, { expiresIn: '1h' }); 

            return h.response({ token }).code(200);
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
  },
});


  //DELETE ACCOUNT FROM DATABASE - DELETE REQUEST
  server.route({
    method: 'DELETE',
    path: '/api/deleteAccount/{id}',
    options: {
      tags: ['api'],
      description: 'Delete an account by ID',
      validate: {
        params: Joi.object({
          id: Joi.number().integer().required().description('ID for delete an account'),
        }),
      },
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
    },
  });
  

  const swaggerOptions = {
    info: {
      title: 'Elecctro To-Do Documentation',
      version: '1.0.0',
    },
    definitions: {
      Todo: {
        type: 'object',
        properties: {
          todo_body: { type: 'string' },
        
        },
        required: ['todo_body'],
      },
    },
  };
  
  
  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions,
    },
  ]);
    

    try {
      await server.start();
      console.log('Server running on %s', server.info.uri);
    } catch (err) {
      console.error('Error starting server:', err);
    }
  };


init();