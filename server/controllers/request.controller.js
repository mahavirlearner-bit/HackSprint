const MaintenanceRequest = require('../models/MaintenanceRequest');
const { sendMaintenanceRequestNotification, sendCompletionNotification, sendOverdueNotification } = require('../services/notification.service');
const { autoAssignTeam, applyAutoAssignment } = require('../services/autoAssign.service');
const {
  canCreateRequest,
  canAssignTechnician,
  canSelfAssign,
  canMoveRequestStatus,
  canScrapeEquipment,
  canDeleteRequest,
  canViewRequest,
  getRequestPermissions
} = require('../services/authorization.service');

// @desc    Create a new maintenance request
// @route   POST /api/requests
// @access  Private (Any authenticated user)
const createRequest = async (req, res) => {
  try {
    // Check if user can create a request
    if (!canCreateRequest(req.user)) {
      return res.status(403).json({
        message: 'Access denied: You do not have permission to create maintenance requests'
      });
    }

    const {
      subject,
      equipment,
      category,
      maintenanceType,
      team,
      technician,
      requestDate,
      scheduledDate,
      durationHours,
      priority,
      company,
      notes,
      instructions,
    } = req.body;

    // Validate required fields
    if (!category) {
      return res.status(400).json({
        message: 'Equipment category is required for auto-assignment'
      });
    }
    
    // Handle empty string technician
    if (technician === '') {
       // assignedTechnician logic below handles null/undefined
    }

    // When a regular user creates a request, it should have status "New" and no assigned technician
    // Only managers can pre-assign technicians at creation time
    let assignedTechnician = null;
    if (technician && req.user.role === 'manager') {
      // Validate technician ID format if provided
      if (technician.match(/^[0-9a-fA-F]{24}$/)) {
        assignedTechnician = technician;
      }
    }

    // Auto-assign team based on equipment category from database
    let autoAssignedTeamName = null;
    let autoAssignedTeamId = team; // Use provided team as fallback
    
    try {
      const assignment = await autoAssignTeam(category);
      autoAssignedTeamName = assignment.assignedTeam;
      autoAssignedTeamId = assignment.teamId;
    } catch (autoAssignError) {
      // Log error but don't fail the request - it might be a new category
      console.error('Auto-assignment error:', autoAssignError.message);
      
      // If team was provided, use it; otherwise return error
      if (!team) {
        return res.status(400).json({
          message: `No team found for category "${category}". Please select a team manually or create a team for this category.`,
          error: autoAssignError.message
        });
      }
      
      autoAssignedTeamName = null; // Will try to fetch team name from team ID
      autoAssignedTeamId = team;
    }

    // If we have a team ID, fetch the team to get the name
    if (autoAssignedTeamId && !autoAssignedTeamName) {
      try {
        const MaintenanceTeam = require('../models/MaintenanceTeam');
        const teamDoc = await MaintenanceTeam.findById(autoAssignedTeamId);
        if (teamDoc) {
          autoAssignedTeamName = teamDoc.teamName;
        }
      } catch (err) {
        console.error('Error fetching team:', err.message);
      }
    }

    // Ensure we have a team name
    if (!autoAssignedTeamName) {
      autoAssignedTeamName = 'Unassigned';
    }

    const newRequest = new MaintenanceRequest({
      subject,
      createdBy: req.user.id,
      requestDate: requestDate || undefined,
      equipment,
      category,
      maintenanceType,
      team: autoAssignedTeamId,
      assignedTeam: autoAssignedTeamName,
      equipmentCategory: category,
      technician: assignedTechnician,
      scheduledDate,
      durationHours,
      priority,
      company,
      status: 'New', // Always create with "New" status
      notes,
      instructions,
    });

    const savedRequest = await newRequest.save();

    // Send notifications if technician is assigned
    if (assignedTechnician) {
      try {
        await sendMaintenanceRequestNotification(null, assignedTechnician, savedRequest, 'assigned');
      } catch (notificationError) {
        console.error('Error sending notification:', notificationError);
        // Don't fail the request if notification fails
      }
    }

    res.status(201).json(savedRequest);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Get all maintenance requests (filtered by role)
// @route   GET /api/requests
// @access  Private
const getAllRequests = async (req, res) => {
  try {
    let query = {};

    // Admins and managers can see all requests
    // Technicians can only see requests assigned to them or created by them
    // Users can only see requests created by them
    if (req.user.role === 'technician') {
      query = {
        $or: [
          { technician: req.user._id },
          { createdBy: req.user._id }
        ]
      };
    } else if (req.user.role === 'user') {
      query = { createdBy: req.user._id };
    }

    const requests = await MaintenanceRequest.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('team', 'teamName')
      .populate('technician', 'firstName lastName');

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Get a maintenance request by ID
// @route   GET /api/requests/:id
// @access  Private
const getRequestById = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id)
      .populate('createdBy', 'firstName lastName')
      .populate('team', 'teamName')
      .populate('technician', 'firstName lastName');

    if (!request) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    // Check if user has permission to view this request
    const permission = canViewRequest(req.user, request);
    if (!permission.allowed) {
      return res.status(403).json({ message: permission.reason });
    }

    // Add permissions info to response
    const response = request.toObject();
    response.permissions = getRequestPermissions(req.user, request);

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Update a maintenance request
// @route   PUT /api/requests/:id
// @access  Private (Role-based)
const updateRequest = async (req, res) => {
  try {
    const {
      subject,
      equipment,
      category,
      maintenanceType,
      team,
      technician,
      scheduledDate,
      durationHours,
      priority,
      company,
      status,
      notes,
      instructions,
    } = req.body;

    const request = await MaintenanceRequest.findById(req.params.id).populate('technician');

    if (!request) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    // Check if user can view this request (basic access control)
    const viewPermission = canViewRequest(req.user, request);
    if (!viewPermission.allowed && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: viewPermission.reason });
    }

    const oldStatus = request.status;
    const oldTechnician = request.technician ? String(request.technician._id || request.technician) : null;

    // Handle empty string technician from frontend
    if (technician === '') {
      req.body.technician = null;
    }

    /**
     * HANDLE TECHNICIAN ASSIGNMENT
     * Rules:
     * - Only managers can assign technicians
     * - Technicians can only self-assign when status is "New"
     */
    if (technician !== undefined && String(technician) !== oldTechnician) {
      if (String(technician) === req.user._id.toString() && req.user.role === 'technician') {
        // Technician self-assignment
        const selfAssignPermission = canSelfAssign(req.user, request);
        if (!selfAssignPermission.allowed) {
          return res.status(403).json({ message: selfAssignPermission.reason });
        }
        request.technician = technician;
      } else {
        // Assigning to another technician
        const assignPermission = canAssignTechnician(req.user, request, technician);
        if (!assignPermission.allowed) {
          return res.status(403).json({ message: assignPermission.reason });
        }
        request.technician = technician;
      }
    }

    /**
     * HANDLE STATUS CHANGES
     * Rules:
     * - Managers can move to any status (including Scrap for equipment scrapping)
     * - Technicians can only move their assigned requests through workflow
     * - Admins cannot modify request status
     */
    if (status !== undefined && status !== oldStatus) {
      const statusPermission = canMoveRequestStatus(req.user, request, status);
      if (!statusPermission.allowed) {
        return res.status(403).json({ message: statusPermission.reason });
      }
      request.status = status;
    }

    /**
     * HANDLE OTHER FIELD UPDATES
     * Rules:
     * - Managers can update most fields
     * - Technicians can update notes/instructions only for their assigned requests
     * - Admins cannot update requests
     */
    if (req.user.role === 'manager' || req.user.role === 'admin') {
      // Managers and admins can update all fields
      if (subject !== undefined) request.subject = subject;
      if (equipment !== undefined) request.equipment = equipment;
      if (category !== undefined) request.category = category;
      if (maintenanceType !== undefined) request.maintenanceType = maintenanceType;
      if (team !== undefined) request.team = team;
      if (scheduledDate !== undefined) request.scheduledDate = scheduledDate;
      if (durationHours !== undefined) request.durationHours = durationHours;
      if (priority !== undefined) request.priority = priority;
      if (company !== undefined) request.company = company;
      if (notes !== undefined) request.notes = notes;
      if (instructions !== undefined) request.instructions = instructions;
    } else if (req.user.role === 'technician') {
      // Technicians can only update notes and instructions for their assigned requests
      const isAssignedToTechnician =
        request.technician && String(request.technician._id) === req.user._id.toString();

      if (!isAssignedToTechnician) {
        return res.status(403).json({
          message: 'You can only update notes and instructions for requests assigned to you'
        });
      }

      // Technicians update ONLY notes and instructions.
      // We ignore other fields present in the body (like subject, priority, etc.)
      // because the frontend form sends the entire object back on save.
      if (notes !== undefined) request.notes = notes;
      if (instructions !== undefined) request.instructions = instructions;
      
      // Explicitly DO NOT update other fields, and DO NOT throw error if they are present.
    }

    const updatedRequest = await request.save();
    const response = updatedRequest.toObject();
    response.permissions = getRequestPermissions(req.user, updatedRequest);

    // Send notifications based on changes
    try {
      // If technician changed, notify new technician
      if (technician && String(technician) !== oldTechnician) {
        await sendMaintenanceRequestNotification(null, technician, updatedRequest, 'assigned');
      }

      // If status changed to "Repaired", notify creator
      if (status === 'Repaired' && oldStatus !== 'Repaired') {
        await sendCompletionNotification(null, updatedRequest.createdBy, updatedRequest);
      }
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the request if notification fails
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Delete a maintenance request
// @route   DELETE /api/requests/:id
// @access  Private (Manager/Admin only)
const deleteRequest = async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    const deletePermission = canDeleteRequest(req.user, request);
    if (!deletePermission.allowed) {
      return res.status(403).json({ message: deletePermission.reason });
    }

    await request.deleteOne();
    res.json({ message: 'Maintenance request removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Check for overdue maintenance requests and send notifications
// @route   POST /api/requests/check-overdue
// @access  Private (Manager/Admin only)
const checkOverdueRequests = async (req, res) => {
  try {
    // Only managers and admins can check overdue requests
    if (!['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Only managers and admins can check overdue requests'
      });
    }

    const now = new Date();
    const overdueRequests = await MaintenanceRequest.find({
      status: { $in: ['New', 'In Progress'] },
      scheduledDate: { $lt: now }
    }).populate('technician', 'firstName lastName');

    let notificationsSent = 0;

    for (const request of overdueRequests) {
      if (request.technician) {
        try {
          await sendOverdueNotification(null, request.technician._id, request);
          notificationsSent++;
        } catch (notificationError) {
          console.error('Error sending overdue notification:', notificationError);
        }
      }
    }

    res.json({
      message: `Checked ${overdueRequests.length} overdue requests, sent ${notificationsSent} notifications`
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Export maintenance requests in specified format
// @route   GET /api/requests/export
// @access  Private (Manager/Admin only)
const exportRequests = async (req, res) => {
  try {
    // Only managers and admins can export requests
    if (!['manager', 'admin'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Only managers and admins can export requests'
      });
    }

    const { format = 'csv', team, status, fromDate, toDate } = req.query;

    // Validate format
    if (!['csv', 'excel', 'pdf'].includes(format.toLowerCase())) {
      return res.status(400).json({
        message: 'Invalid format. Supported formats: csv, excel, pdf'
      });
    }

    // Build query filters
    let query = {};

    if (team) {
      query.assignedTeam = new RegExp(team, 'i');
    }

    if (status) {
      query.status = status;
    }

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const fromDateObj = new Date(fromDate);
        fromDateObj.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDateObj;
      }
      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDateObj;
      }
    }

    // Fetch requests with filters
    const requests = await MaintenanceRequest.find(query)
      .populate('technician', 'firstName lastName')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    if (requests.length === 0) {
      return res.status(404).json({
        message: 'No requests found matching the criteria'
      });
    }

    const { exportToCSV, exportToExcel, exportToPDF } = require('../utils/exportUtils');

    try {
      let filePath;
      const timestamp = new Date().toISOString().slice(0, 10);
      
      switch (format.toLowerCase()) {
        case 'csv':
          filePath = await exportToCSV(requests, `requests-${timestamp}.csv`);
          if (!filePath) {
            throw new Error('Failed to generate CSV file');
          }
          res.download(filePath, `maintenance-requests-${timestamp}.csv`, (err) => {
            if (err) {
              console.error('Download error:', err);
            }
          });
          break;

        case 'excel':
          filePath = await exportToExcel(requests, `requests-${timestamp}.xlsx`);
          if (!filePath) {
            throw new Error('Failed to generate Excel file');
          }
          res.download(filePath, `maintenance-requests-${timestamp}.xlsx`, (err) => {
            if (err) {
              console.error('Download error:', err);
            }
          });
          break;

        case 'pdf':
          filePath = await exportToPDF(requests, `requests-${timestamp}.pdf`);
          if (!filePath) {
            throw new Error('Failed to generate PDF file');
          }
          res.download(filePath, `maintenance-requests-${timestamp}.pdf`, (err) => {
            if (err) {
              console.error('Download error:', err);
            }
          });
          break;

        default:
          return res.status(400).json({
            message: 'Unsupported export format'
          });
      }
    } catch (exportError) {
      console.error('Export error details:', exportError);
      res.status(500).json({
        message: 'Failed to export requests: ' + (exportError.message || 'Unknown error'),
        error: exportError.message
      });
    }
  } catch (error) {
    console.error('Export controller error:', error);
    res.status(500).json({ 
      message: 'Server Error', 
      error: error.message,
      details: error.stack 
    });
  }
};

// @desc    Get team mapping for auto-assignment
// @route   GET /api/requests/team-mapping
// @access  Private
const getTeamMapping = async (req, res) => {
  try {
    const { getTeamsByCategory, getAvailableCategories } = require('../services/autoAssign.service');
    
    const teamsByCategory = await getTeamsByCategory();
    const categories = await getAvailableCategories();

    res.json({
      categories,
      teamsByCategory,
      message: 'Team mapping retrieved successfully from database'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

// @desc    Preview team assignment for equipment category
// @route   POST /api/requests/preview-assignment
// @access  Private
const previewTeamAssignment = async (req, res) => {
  try {
    console.log('🔍 previewTeamAssignment called with body:', req.body);
    const { equipmentCategory } = req.body;

    if (!equipmentCategory) {
      console.log('❌ Equipment category is required');
      return res.status(400).json({
        message: 'Equipment category is required'
      });
    }

    try {
      console.log('📊 Looking up team for category:', equipmentCategory);
      const assignment = await autoAssignTeam(equipmentCategory);
      console.log('✅ Found assignment:', assignment);

      res.json({
        equipmentCategory: equipmentCategory,
        assignedTeam: assignment.assignedTeam,
        teamId: assignment.teamId,
        isAutoAssigned: assignment.isAutoAssigned,
        isFromDatabase: assignment.isFromDatabase
      });
    } catch (assignError) {
      // Return 200 with nulls instead of 404 to avoid frontend errors
      // The frontend can handle assignedTeam being null
      res.status(200).json({
        message: assignError.message,
        equipmentCategory: equipmentCategory,
        assignedTeam: null,
        teamId: null
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message, stack: error.stack });
  }
};

module.exports = {
  createRequest,
  getAllRequests,
  getRequestById,
  updateRequest,
  deleteRequest,
  checkOverdueRequests,
  exportRequests,
  getTeamMapping,
  previewTeamAssignment,
};
