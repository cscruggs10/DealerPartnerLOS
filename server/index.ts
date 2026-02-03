import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const prisma = new PrismaClient()
const PORT = process.env.PORT || 3001

app.use(cors())
// Increase limit for file uploads (base64 encoded)
app.use(express.json({ limit: '50mb' }))

// API Routes

// Get all leases (admin) or dealer's leases
app.get('/api/leases', async (req, res) => {
  try {
    const { clerkId, isAdmin } = req.query

    if (isAdmin === 'true') {
      // Admin sees all leases with dealer info and document counts
      const leases = await prisma.lease.findMany({
        include: {
          dealer: true,
          documents: {
            select: {
              id: true,
              type: true,
              status: true,
              fileName: true,
              uploadedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
      return res.json(leases)
    }

    if (!clerkId) {
      return res.status(400).json({ error: 'clerkId required' })
    }

    // Find dealer by Clerk ID
    const dealer = await prisma.dealer.findUnique({
      where: { clerkId: String(clerkId) }
    })

    if (!dealer) {
      return res.json([]) // New dealer, no leases yet
    }

    // Get dealer's leases with documents
    const leases = await prisma.lease.findMany({
      where: { dealerId: dealer.id },
      include: {
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            fileName: true,
            uploadedAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return res.json(leases)
  } catch (error) {
    console.error('Error fetching leases:', error)
    return res.status(500).json({ error: 'Failed to fetch leases' })
  }
})

// Create a new lease
app.post('/api/leases', async (req, res) => {
  try {
    const { clerkId, leaseData } = req.body

    if (!clerkId) {
      return res.status(400).json({ error: 'clerkId required' })
    }

    // Find or create dealer
    let dealer = await prisma.dealer.findUnique({
      where: { clerkId }
    })

    if (!dealer) {
      // Create dealer with info from request
      dealer = await prisma.dealer.create({
        data: {
          clerkId,
          phone: leaseData.dealerPhone || 'unknown',
          name: leaseData.dealerName,
          address: leaseData.dealerAddress
        }
      })
    }

    // Create lease
    const lease = await prisma.lease.create({
      data: {
        dealerId: dealer.id,
        status: 'PENDING',
        customerFirstName: leaseData.customerFirstName,
        customerLastName: leaseData.customerLastName,
        customerAddress: leaseData.customerAddress,
        customerCity: leaseData.customerCity,
        customerState: leaseData.customerState,
        customerZip: leaseData.customerZip,
        customerPhone: leaseData.customerPhone,
        coLesseeFirstName: leaseData.coLesseeFirstName,
        coLesseeLastName: leaseData.coLesseeLastName,
        vehicleYear: leaseData.vehicleYear,
        vehicleMake: leaseData.vehicleMake,
        vehicleModel: leaseData.vehicleModel,
        vehicleVin: leaseData.vehicleVin,
        vehicleMileage: leaseData.vehicleMileage,
        dealData: leaseData.dealData
      }
    })

    return res.json(lease)
  } catch (error) {
    console.error('Error creating lease:', error)
    return res.status(500).json({ error: 'Failed to create lease' })
  }
})

// Update lease status
app.patch('/api/leases/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const validStatuses = ['PENDING', 'POSTED', 'CHECKLIST', 'FUNDED', 'ACTIVE', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const lease = await prisma.lease.update({
      where: { id },
      data: { status }
    })

    return res.json(lease)
  } catch (error) {
    console.error('Error updating lease:', error)
    return res.status(500).json({ error: 'Failed to update lease' })
  }
})

// Update lease verification fields
app.patch('/api/leases/:id/verification', async (req, res) => {
  try {
    const { id } = req.params
    const { customerEmail, customerEmailVerified, customerCellVerified } = req.body

    const updateData: Record<string, unknown> = {}
    if (customerEmail !== undefined) updateData.customerEmail = customerEmail
    if (customerEmailVerified !== undefined) updateData.customerEmailVerified = customerEmailVerified
    if (customerCellVerified !== undefined) updateData.customerCellVerified = customerCellVerified

    const lease = await prisma.lease.update({
      where: { id },
      data: updateData
    })

    return res.json(lease)
  } catch (error) {
    console.error('Error updating lease verification:', error)
    return res.status(500).json({ error: 'Failed to update verification' })
  }
})

// Delete a lease (only PENDING can be deleted)
app.delete('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params

    const lease = await prisma.lease.findUnique({ where: { id } })

    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' })
    }

    if (lease.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only PENDING leases can be deleted' })
    }

    await prisma.lease.delete({ where: { id } })
    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting lease:', error)
    return res.status(500).json({ error: 'Failed to delete lease' })
  }
})

// Get single lease with full details
app.get('/api/leases/:id', async (req, res) => {
  try {
    const { id } = req.params

    const lease = await prisma.lease.findUnique({
      where: { id },
      include: {
        dealer: true,
        documents: {
          select: {
            id: true,
            type: true,
            status: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            notes: true,
            uploadedAt: true,
            reviewedAt: true
          }
        }
      }
    })

    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' })
    }

    return res.json(lease)
  } catch (error) {
    console.error('Error fetching lease:', error)
    return res.status(500).json({ error: 'Failed to fetch lease' })
  }
})

// Upload document for a lease
app.post('/api/leases/:id/documents', async (req, res) => {
  try {
    const { id } = req.params
    const { type, fileName, fileSize, mimeType, fileData } = req.body

    // Validate document type
    const validTypes = [
      'CONTRACT', 'TIER_SHEET', 'DRIVERS_LICENSE', 'PROOF_OF_RESIDENCE',
      'PROOF_OF_INCOME', 'INSURANCE', 'CREDIT_APPLICATION', 'CREDIT_REPORT',
      'TITLE_APPLICATION'
    ]
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid document type' })
    }

    // Check if lease exists
    const lease = await prisma.lease.findUnique({ where: { id } })
    if (!lease) {
      return res.status(404).json({ error: 'Lease not found' })
    }

    // Check if document of this type already exists
    const existingDoc = await prisma.leaseDocument.findFirst({
      where: { leaseId: id, type }
    })

    if (existingDoc) {
      // Update existing document
      const document = await prisma.leaseDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileName,
          fileSize,
          mimeType,
          fileData,
          status: 'PENDING',
          notes: null,
          reviewedAt: null,
          uploadedAt: new Date()
        }
      })
      return res.json(document)
    }

    // Create new document
    const document = await prisma.leaseDocument.create({
      data: {
        leaseId: id,
        type,
        fileName,
        fileSize,
        mimeType,
        fileData,
        status: 'PENDING'
      }
    })

    return res.json(document)
  } catch (error) {
    console.error('Error uploading document:', error)
    return res.status(500).json({ error: 'Failed to upload document' })
  }
})

// Get document file data (for download/preview)
app.get('/api/documents/:id/file', async (req, res) => {
  try {
    const { id } = req.params

    const document = await prisma.leaseDocument.findUnique({
      where: { id },
      select: {
        fileName: true,
        mimeType: true,
        fileData: true
      }
    })

    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    return res.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return res.status(500).json({ error: 'Failed to fetch document' })
  }
})

// Delete a document
app.delete('/api/documents/:id', async (req, res) => {
  try {
    const { id } = req.params

    await prisma.leaseDocument.delete({ where: { id } })
    return res.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return res.status(500).json({ error: 'Failed to delete document' })
  }
})

// Admin: Update document status (approve/reject)
app.patch('/api/documents/:id/status', async (req, res) => {
  try {
    const { id } = req.params
    const { status, notes } = req.body

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const document = await prisma.leaseDocument.update({
      where: { id },
      data: {
        status,
        notes,
        reviewedAt: new Date()
      }
    })

    return res.json(document)
  } catch (error) {
    console.error('Error updating document status:', error)
    return res.status(500).json({ error: 'Failed to update document status' })
  }
})

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
