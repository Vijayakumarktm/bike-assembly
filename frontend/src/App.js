import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    BarChart, Bar, ResponsiveContainer
} from 'recharts';

const API_URL = 'http://localhost:5000/api';

function Login({ onLogin }) {
    const [username, setUsername] = useState('emp1');
    const [password, setPassword] = useState('pass1');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_URL}/login`, { username, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('employee', JSON.stringify(response.data.employee));
            onLogin(response.data.employee);
        } catch (error) {
            alert('Invalid credentials');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="p-8 bg-white rounded-lg shadow-md w-96">
                <h2 className="mb-6 text-2xl font-bold text-gray-800">Login</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            Username
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            Password
                        </label>
                        <input
                            type="password"
                            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
}

function EmployeeDashboard({ employee, onLogout }) {
    const [assemblyInProgress, setAssemblyInProgress] = useState(false);
    const [currentBike, setCurrentBike] = useState(null);
    const [remainingTime, setRemainingTime] = useState(0);
    const [bikes, setBikes] = useState([]);
    const timerRef = useRef(null);

    useEffect(() => {
        fetchBikes();
        fetchCurrentAssembly();
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    const fetchBikes = async () => {
        try {
            const response = await axios.get(`${API_URL}/bikes`);
            setBikes(response.data);
        } catch (error) {
            console.error('Error fetching bikes:', error);
        }
    };

    const fetchCurrentAssembly = async () => {
        try {
            const response = await axios.get(`${API_URL}/assembly/current/${employee.id}`);
            if (response.data.assemblyInProgress) {
                setAssemblyInProgress(true);
                setCurrentBike(response.data.bikeName);
                const startTime = new Date(response.data.startTime).getTime();
                const expectedEndTime = new Date(response.data.expectedEndTime).getTime();
                const now = new Date().getTime();
                const remaining = Math.max(expectedEndTime - now, 0);
                setRemainingTime(remaining);
                startTimer(remaining);
            }
        } catch (error) {
            console.error('Error fetching current assembly:', error);
        }
    };

    const startTimer = (duration) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        const endTime = Date.now() + duration;

        timerRef.current = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(endTime - now, 0);

            setRemainingTime(remaining);

            if (remaining <= 0) {
                clearInterval(timerRef.current);
                setAssemblyInProgress(false);
                setCurrentBike(null);
            }
        }, 1000);
    };

    const formatTime = (ms) => {
        if (isNaN(ms) || ms < 0) return "0:00";
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(1, '0')}`;
    };

    const startAssembly = async (bikeId) => {
        try {
            const response = await axios.post(`${API_URL}/assembly/start`, {
                employeeId: employee.id,
                bikeId
            });

            console.log('Assembly start response:', response.data); // For debugging

            if (response.data && response.data.id) {
                setAssemblyInProgress(true);

                // Find the bike in our local state
                const selectedBike = bikes.find(bike => bike.id === bikeId);
                if (selectedBike) {
                    setCurrentBike(selectedBike.name);
                } else {
                    console.error('Selected bike not found in local state');
                    setCurrentBike('Unknown bike');
                }

                // Calculate assembly time
                const startTime = new Date(response.data.startTime);
                const expectedEndTime = new Date(response.data.expectedEndTime);
                const assemblyTime = expectedEndTime - startTime;

                setRemainingTime(assemblyTime);
                startTimer(assemblyTime);
                fetchBikes(); // Refresh the bike list after starting an assembly
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Error starting assembly:', error);
            if (error.response && error.response.status === 400) {
                alert(error.response.data.message);
            } else {
                alert('Error starting assembly. Please try again.');
            }
        }
    };

    const completeAssembly = async () => {
        try {
            await axios.post(`${API_URL}/assembly/end`, { employeeId: employee.id });
            setAssemblyInProgress(false);
            setCurrentBike(null);
            setRemainingTime(0);

            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            fetchBikes(); // Refresh the bike list after completing an assembly
        } catch (error) {
            console.error('Error completing assembly:', error);
            alert('Error completing assembly. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-white shadow">
                <div className="flex items-center justify-between px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Welcome, {employee.name}
                    </h1>
                    <button
                        onClick={onLogout}
                        className="px-4 py-2 font-bold text-white bg-red-500 rounded hover:bg-red-700 focus:outline-none focus:shadow-outline"
                    >
                        Logout
                    </button>
                </div>
            </header>
            <main>
                <div className="py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="px-4 py-6 sm:px-0">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {bikes.map(bike => (
                                <button
                                    key={bike.id}
                                    onClick={() => startAssembly(bike.id)}
                                    disabled={assemblyInProgress || bike.status === 'in-progress' || bike.status === 'completed'}
                                    className={`p-6 rounded-lg shadow-md text-center transition-all ${assemblyInProgress || bike.status === 'in-progress' || bike.status === 'completed'
                                        ? 'bg-gray-200 cursor-not-allowed'
                                        : 'bg-white hover:shadow-lg hover:scale-105'
                                        }`}
                                >
                                    <h3 className="mb-2 text-xl font-semibold">{bike.name}</h3>
                                    <p className="text-gray-600">
                                        {bike.assemblyTime} minutes
                                    </p>
                                    {bike.status === 'in-progress' && (
                                        <div>
                                            <p className="mt-2 text-blue-600">Assembly in Progress</p>
                                            <p className="mt-2 text-blue-600">by {bike?.currentAssembly?.employee.name}</p>
                                        </div>
                                    )}
                                    {bike.status === 'completed' && (
                                        <div>
                                            <p className="mt-2 text-green-600">Assembly Completed</p>
                                            <p className="mt-2 text-blue-600">by {bike?.currentAssembly?.employee.name}</p>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        {assemblyInProgress && (
                            <div className="p-6 mt-8 bg-blue-100 rounded-lg">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="mb-2 text-xl font-semibold">Assembly in Progress</h3>
                                        <p className="text-gray-700">Currently assembling: {currentBike}</p>
                                        <p className="text-gray-700">Time remaining: {formatTime(remainingTime)}</p>
                                    </div>
                                    <button
                                        onClick={completeAssembly}
                                        className="px-4 py-2 font-bold text-white transition duration-150 ease-in-out bg-green-500 rounded hover:bg-green-600 focus:outline-none focus:shadow-outline"
                                    >
                                        Complete Assembly
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function AdminDashboard({ onLogout }) {
    const today = new Date().toISOString().split('T')[0];
    const [assemblies, setAssemblies] = useState([]);
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    const fetchAssemblies = async () => {
        try {
            const response = await axios.get(`${API_URL}/assemblies/status`, {
                params: { startDate, endDate }
            });
            setAssemblies(response.data);
        } catch (error) {
            alert('Error fetching assemblies');
        }
    };

    useEffect(() => {
        fetchAssemblies();
    }, [startDate, endDate]);

    const groupByBikeInprogress = assemblies.reduce((acc, assembly) => {
        if (assembly.status === 'in-progress') {  // Add condition to check for 'in-progress' status
            acc[assembly.BikeId] = (acc[assembly.BikeId] || 0) + 1;
        }
        return acc;
    }, {});

    const groupByBikeCompleted = assemblies.reduce((acc, assembly) => {
        if (assembly.status === 'completed') {  // Add condition to check for 'in-progress' status
            acc[assembly.BikeId] = (acc[assembly.BikeId] || 0) + 1;
        }
        return acc;
    }, {});

    const groupByEmployee = assemblies.reduce((acc, assembly) => {
        const employeeName = assembly.Employee.name;
        acc[employeeName] = (acc[employeeName] || 0) + 1;
        return acc;
    }, {});

    const bikeData = Object.entries(groupByBikeInprogress).map(([name, value]) => ({
        name, value
    }));

    const bikeCompletedData = Object.entries(groupByBikeCompleted).map(([name, value]) => ({
        name, value
    }));

    const employeeData = Object.entries(groupByEmployee).map(([name, value]) => ({
        name, value
    }));

    return (
        <div className="min-h-screen p-8 bg-gray-100">
            <div className="max-w-6xl mx-auto">
                {/* <h2 className="mb-8 text-3xl font-bold text-gray-800">Admin Dashboard</h2> */}
                <header className="bg-white shadow">
                    <div className="flex items-center justify-between px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
                        <h1 className="text-3xl font-bold text-gray-900">
                            Admin Dashboard
                        </h1>
                        <button
                            onClick={onLogout}
                            className="px-4 py-2 font-bold text-white bg-red-500 rounded hover:bg-red-700 focus:outline-none focus:shadow-outline"
                        >
                            Logout
                        </button>
                    </div>
                </header>
                <div className="p-6 mb-8 bg-white rounded-lg shadow-md">
                    <div className="flex mb-6 space-x-4">
                        <div>
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-bold text-gray-700">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div>
                            <h3 className="mb-4 text-xl font-semibold">Bikes Assemble Inprogress</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={bikeData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#3B82F6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <h3 className="mb-4 text-xl font-semibold">Bikes Assembled</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={bikeCompletedData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#3B82F6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div>
                            <h3 className="mb-4 text-xl font-semibold">Employee Production</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={employeeData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#10B981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const employee = localStorage.getItem('employee');
        if (employee) {
            setUser(JSON.parse(employee));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        setUser(null);
    };

    return (
        <Router>
            <Routes>
                <Route
                    path="/login"
                    element={user ? <Navigate to="/" /> : <Login onLogin={setUser} />}
                />
                <Route
                    path="/"
                    element={
                        user ? (
                            user.role === 1 ? (
                                <AdminDashboard onLogout={handleLogout} />
                            ) : (
                                <EmployeeDashboard employee={user} onLogout={handleLogout} />
                            )
                        ) : (
                            <Navigate to="/login" />
                        )
                    }
                />
            </Routes>
        </Router>
    );
}

export default App;