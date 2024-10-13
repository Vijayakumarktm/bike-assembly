const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Op } = require('sequelize');

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const sequelize = new Sequelize('bike', 'root', '12345678', {
    host: 'localhost',
    dialect: 'mysql'
});

// Models
const Employee = sequelize.define('Employee', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.INTEGER,
    }
});

const Assembly = sequelize.define('Assembly', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    endTime: {
        type: DataTypes.DATE,
    },
    status: {
        type: DataTypes.ENUM('in-progress', 'completed'),
        defaultValue: 'in-progress'
    },
    expectedEndTime: {
        type: DataTypes.DATE,
        allowNull: false
    }
});

const Bike = sequelize.define('Bike', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    assemblyTime: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

// Define associations
Employee.hasMany(Assembly);
Assembly.belongsTo(Employee);
Bike.hasMany(Assembly);
Assembly.belongsTo(Bike);

// Static employee data
const employees = [
    { username: 'emp1', password: 'pass1', name: 'John Doe', role: 2 },
    { username: 'emp2', password: 'pass2', name: 'Jane Smith', role: 2 },
    { username: 'emp3', password: 'pass3', name: 'Bob Johnson', role: 2 },
    { username: 'emp4', password: 'pass4', name: 'Alice Brown', role: 2 },
    { username: 'emp5', password: 'pass5', name: 'Charlie Wilson', role: 2 },
    { username: 'admin', password: 'admin1', name: 'Admin', role: 1 },
];

// Database initialization
async function initializeDatabase() {
    try {
        await sequelize.sync({ force: true }); // This will drop existing tables
        await Employee.bulkCreate(employees);
        initializeBikes();
        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

async function initializeBikes() {
    const bikes = [
        { name: 'Bike 1', assemblyTime: 50 },
        { name: 'Bike 2', assemblyTime: 60 },
        { name: 'Bike 3', assemblyTime: 80 }
    ];
    await Bike.bulkCreate(bikes);
}

// initializeDatabase();

// Routes
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const employee = await Employee.findOne({ where: { username, password } });
        if (!employee) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: employee.id }, 'secret_key');
        res.json({ token, employee });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

async function autoCompleteAssembly(assemblyId) {
    const assembly = await Assembly.findByPk(assemblyId);
    if (assembly && assembly.status === 'in-progress') {
        assembly.status = 'completed';
        assembly.endTime = new Date();
        await assembly.save();
        console.log(`Assembly ${assemblyId} auto-completed.`);
    }
}

app.get('/api/bikes', async (req, res) => {
    try {
        const bikes = await Bike.findAll({
            include: [{
                model: Assembly,
                required: false,
                include: [{
                    model: Employee,
                    attributes: ['id', 'name']
                }]
            }]
        });

        const bikesWithStatus = bikes.map(bike => {
            const currentAssembly = bike.Assemblies && bike.Assemblies[0];
            let status = 'available'; // Default status is available
            if (currentAssembly) {
                status = currentAssembly.status === 'in-progress' ? 'in-progress' :
                    currentAssembly.status === 'completed' ? 'completed' :
                        status;
            }

            return {
                id: bike.id,
                name: bike.name,
                assemblyTime: bike.assemblyTime,
                status,
                currentAssembly: currentAssembly ? {
                    id: currentAssembly.id,
                    startTime: currentAssembly.startTime,
                    expectedEndTime: currentAssembly.expectedEndTime,
                    employee: currentAssembly.Employee ? {
                        id: currentAssembly.Employee.id,
                        name: currentAssembly.Employee.name
                    } : null
                } : null
            };
        });

        res.json(bikesWithStatus);
    } catch (error) {
        console.error('Error fetching bikes:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/api/assembly/start', async (req, res) => {
    const { employeeId, bikeId } = req.body;
    try {
        const ongoingAssembly = await Assembly.findOne({
            where: {
                EmployeeId: employeeId,
                status: 'in-progress'
            }
        });

        if (ongoingAssembly) {
            return res.status(400).json({
                message: 'You have an ongoing assembly. Please complete it before starting a new one.'
            });
        }

        const bike = await Bike.findByPk(bikeId);
        if (!bike) {
            return res.status(404).json({ message: 'Bike not found' });
        }

        const startTime = new Date();
        const expectedEndTime = new Date(startTime.getTime() + bike.assemblyTime * 60000);

        const assembly = await Assembly.create({
            EmployeeId: employeeId,
            BikeId: bikeId,
            startTime,
            endTime: null,
            status: 'in-progress',
            expectedEndTime
        });

        const timeUntilCompletion = expectedEndTime.getTime() - startTime.getTime();
        setTimeout(() => autoCompleteAssembly(assembly.id), timeUntilCompletion);

        res.json(assembly);
    } catch (error) {
        console.error('Error in assembly start:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/assembly/current/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;

        const currentAssembly = await Assembly.findOne({
            where: {
                EmployeeId: employeeId,
                status: 'in-progress'
            },
            include: [Bike]
        });

        if (currentAssembly) {
            res.json({
                assemblyInProgress: true,
                bikeName: currentAssembly.Bike.name,
                startTime: currentAssembly.startTime,
                expectedEndTime: currentAssembly.expectedEndTime
            });
        } else {
            res.json({ assemblyInProgress: false });
        }
    } catch (error) {
        console.error('Error fetching current assembly:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/assemblies', async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const whereClause = {
            status: 'completed'
        };
        if (startDate && endDate) {
            whereClause.startTime = {
                [Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const assemblies = await Assembly.findAll({
            where: whereClause,
            include: [Employee, Bike]
        });
        res.json(assemblies);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/assemblies/details', async (req, res) => {
    const { startDate, endDate } = req.query;

    try {
        let startDateFilter;
        let endDateFilter;

        // Check if startDate and endDate are provided
        if (startDate && endDate) {
            // Create Date objects from the incoming parameters
            startDateFilter = new Date(startDate);
            endDateFilter = new Date(endDate);

            // Set end date to the end of the specified day
            endDateFilter.setHours(23, 59, 59, 999);
        } else {
            // Default to today's date if no dates are provided
            startDateFilter = new Date();
            startDateFilter.setHours(0, 0, 0, 0); // Start of today
            endDateFilter = new Date();
            endDateFilter.setHours(23, 59, 59, 999); // End of today
        }

        // Ensure valid date range
        if (startDateFilter > endDateFilter) {
            return res.status(400).json({ message: 'Start date must be before end date' });
        }

        // Fetch assemblies with appropriate filters
        const assemblies = await Assembly.findAll({
            where: {
                status: {
                    [Sequelize.Op.or]: ['completed', 'in-progress'] // Fetch both 'completed' and 'in-progress'
                },
                startTime: {
                    [Sequelize.Op.between]: [startDateFilter, endDateFilter] // Filter by provided dates
                }
            },
            include: [Employee, Bike]
        });

        res.json(assemblies);
    } catch (error) {
        console.error('Error fetching assemblies for the specified dates:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.post('/api/assembly/end', async (req, res) => {
    try {
        const { employeeId } = req.body;

        const assembly = await Assembly.findOne({
            where: {
                EmployeeId: employeeId,
                status: 'in-progress'
            }
        });

        if (!assembly) {
            return res.status(404).json({ message: 'No ongoing assembly found for this employee' });
        }

        assembly.status = 'completed';
        assembly.endTime = new Date();
        await assembly.save();

        res.json({ message: 'Assembly completed successfully', assembly });
    } catch (error) {
        console.error('Error ending assembly:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});