# API Documentation for Random-Fact-Generator API

## Overview

The Random-Fact-Generator API provides endpoints to retrieve fascinating facts across various categories. This API is designed to be simple and efficient, allowing developers to integrate fun and educational content into their applications.

## Base URL

```
https://api.your-domain.com/v1
```

## Endpoints

### 1. Get a Random Fact

- **Endpoint:** `/fact`
- **Method:** `GET`
- **Description:** Retrieves a random fact from the database.
- **Request Headers:**
  - `X-API-KEY`: Your API key for authentication.
  
- **Response:**
  - **Status 200:** Successful retrieval of a random fact.
    ```json
    {
      "status": "success",
      "fact": "Did you know that honey never spoils?",
      "category": "food"
    }
    ```
  - **Status 401:** Unauthorized access.
    ```json
    {
      "status": "error",
      "message": "Invalid API key."
    }
    ```

### 2. Get a Random Fact by Category

- **Endpoint:** `/fact/{category}`
- **Method:** `GET`
- **Description:** Retrieves a random fact from a specified category.
- **Path Parameters:**
  - `category`: The category of the fact (e.g., `science`, `history`, `pop_culture`).
  
- **Request Headers:**
  - `X-API-KEY`: Your API key for authentication.
  
- **Response:**
  - **Status 200:** Successful retrieval of a random fact from the specified category.
    ```json
    {
      "status": "success",
      "fact": "The Eiffel Tower can be 15 cm taller during the summer.",
      "category": "history"
    }
    ```
  - **Status 404:** Category not found.
    ```json
    {
      "status": "error",
      "message": "Category not found."
    }
    ```

### 3. User Registration

- **Endpoint:** `/users/register`
- **Method:** `POST`
- **Description:** Registers a new user and generates an API key.
- **Request Body:**
  ```json
  {
    "username": "exampleUser",
    "password": "securePassword"
  }
  ```
  
- **Response:**
  - **Status 201:** User successfully registered.
    ```json
    {
      "status": "success",
      "apiKey": "your_generated_api_key"
    }
    ```
  - **Status 400:** Bad request (e.g., missing fields).
    ```json
    {
      "status": "error",
      "message": "Username and password are required."
    }
    ```

### 4. AI Interaction

- **Endpoint:** `/ai/respond`
- **Method:** `POST`
- **Description:** Sends a prompt to the AI service and retrieves a generated response.
- **Request Body:**
  ```json
  {
    "prompt": "Tell me an interesting fact about space."
  }
  ```
  
- **Response:**
  - **Status 200:** Successful response from the AI service.
    ```json
    {
      "status": "success",
      "response": "A day on Venus is longer than a year on Venus."
    }
    ```
  - **Status 500:** Internal server error.
    ```json
    {
      "status": "error",
      "message": "AI service is currently unavailable."
    }
    ```

## Error Handling

All error responses will follow a consistent format:

```json
{
  "status": "error",
  "message": "Error description."
}
```

## Rate Limiting

The API enforces rate limits based on the user's subscription plan. Exceeding the limit will result in a `429 Too Many Requests` response.

## Conclusion

This API documentation provides a comprehensive overview of the available endpoints, request/response formats, and error handling for the Random-Fact-Generator API. For further assistance, please contact support at `support@your-domain.com`.