import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import PageNotFound from "./lib/PageNotFound";

import Home from "./pages/home";
import Schedule from "./pages/schedule";
import Chat from "./pages/chat";
import Memory from "./pages/memory";

import Login from "./pages/Login";
import Register from "./pages/register";
import GoogleSync from "./pages/google-sync";

import Layout from "./components/Layout";


function AppRoutes() {

  return (
    <Routes>


      <Route path="/login" element={<Login />} />

      <Route path="/register" element={<Register />} />

      <Route path="/google-sync" element={<ProtectedRoute><GoogleSync /></ProtectedRoute>} />


      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >

        <Route index element={<Home />} />

        <Route path="schedule" element={<Schedule />} />

        <Route path="chat" element={<Chat />} />

        <Route path="memory" element={<Memory />} />

      </Route>


      <Route path="*" element={<PageNotFound />} />

    </Routes>
  );
}



export default function App(){

  return (

    <AuthProvider>

      <Router>

        <AppRoutes />

      </Router>

    </AuthProvider>

  );

}
