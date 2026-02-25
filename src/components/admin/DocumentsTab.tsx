import React, { useState, useEffect } from 'react';
import { FileText, Plus, Eye, CreditCard as Edit, Trash2, AlertTriangle, Search, Filter } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { DocumentEditModal } from './DocumentEditModal';
import { UploadModal } from '../documents/UploadModal';
import { formatDate } from '../../lib/utils';
import { fetchWithAuth } from '../../lib/api';

export function DocumentsTab() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showEditDocumentModal, setShowEditDocumentModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const data = await fetchWithAuth('/documents');
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDocument = (document: any) => {
    setDocumentToEdit(document);
    setShowEditDocumentModal(true);
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      await fetchWithAuth(`/documents/${documentToDelete.id}`, {
        method: 'DELETE'
      });

      await loadDocuments();
      setShowDeleteConfirm(false);
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDocument = (document: any) => {
    setSelectedDocument(document);
    setShowDocumentModal(true);
  };

  const handleUpdateSuccess = () => {
    loadDocuments();
    setShowEditDocumentModal(false);
    setDocumentToEdit(null);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (doc.citation && doc.citation.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || doc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col h-full space-y-4 sm:space-y-6 overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex-none flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Documents Management</h2>
        <Button onClick={() => setShowUploadModal(true)} className="w-full sm:w-auto min-h-[44px]">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Document</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex-none flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="case">Cases</option>
            <option value="statute">Statutes</option>
            <option value="regulation">Regulations</option>
            <option value="practice_note">Practice Notes</option>
            <option value="template">Templates</option>
          </select>
        </div>
      </div>

      {/* Documents List (Mobile) */}
      <div className="flex-1 overflow-y-auto space-y-4 sm:hidden pb-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No documents found</p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${
                      doc.type === 'case'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : doc.type === 'statute'
                        ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate pr-2">
                        {doc.title}
                      </h3>
                      {doc.citation && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {doc.citation}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ${
                    doc.status === 'ready'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      : doc.status === 'processing'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                      : doc.status === 'error'
                      ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {doc.status ? doc.status.toUpperCase() : 'PENDING'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Type</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium capitalize">{doc.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Jurisdiction</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium capitalize">{doc.jurisdiction}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Date</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatDate(doc.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block text-xs">Uploaded By</span>
                    <span className="text-gray-900 dark:text-gray-100">{doc.uploader?.name || 'System'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDocument(doc)}
                    className="text-gray-600 dark:text-gray-300"
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditDocument(doc)}
                    className="text-gray-600 dark:text-gray-300"
                  >
                    <Edit className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDocumentToDelete(doc);
                      setShowDeleteConfirm(true);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Documents Table (Desktop) */}
      <Card className="hidden sm:flex flex-col flex-1 min-h-0 w-full overflow-hidden min-w-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0 overflow-hidden min-w-0">
          <div className="flex-1 overflow-auto scrollbar-sleek w-full">
            <table className="w-full min-w-[1000px] xl:min-w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jurisdiction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="animate-pulse space-y-2">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 animate-pulse"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-start space-x-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            doc.type === 'case'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                              : doc.type === 'statute'
                              ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {doc.title}
                            </p>
                            {doc.citation && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{doc.citation}</p>
                            )}
                            {doc.year && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">Year: {doc.year}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          doc.type === 'case'
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                            : doc.type === 'statute'
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                            : doc.type === 'regulation'
                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {doc.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          doc.status === 'ready'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : doc.status === 'processing'
                            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                            : doc.status === 'error'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}>
                          {doc.status ? doc.status.toUpperCase() : 'PENDING'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 capitalize">
                        {doc.jurisdiction}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {doc.uploader?.name || 'System'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                            title="View Details"
                            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditDocument(doc)}
                            title="Edit Document"
                            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDocumentToDelete(doc);
                              setShowDeleteConfirm(true);
                            }}
                            title="Delete Document"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Document Details Modal */}
      <Modal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        title="Document Details"
        maxWidth="2xl"
      >
        {selectedDocument && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedDocument.title}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">{selectedDocument.type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Citation</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedDocument.citation || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedDocument.year || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jurisdiction</label>
                <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">{selectedDocument.jurisdiction}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Uploaded By</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{selectedDocument.uploader?.name || 'System'}</p>
              </div>
            </div>
            
            {selectedDocument.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <p className="text-sm text-gray-900 dark:text-gray-100">{selectedDocument.description}</p>
                </div>
              </div>
            )}

            {selectedDocument.tags && selectedDocument.tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {selectedDocument.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File Size</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedDocument.file_size
                    ? `${(selectedDocument.file_size / 1024 / 1024).toFixed(2)} MB`
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Access</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {selectedDocument.is_public ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedDocument.created_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Updated</label>
                <p className="text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedDocument.updated_at)}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end space-y-reverse space-y-3 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={() => setShowDocumentModal(false)} className="w-full sm:w-auto min-h-[44px]">
                Close
              </Button>
              <Button onClick={() => {
                setShowDocumentModal(false);
                handleEditDocument(selectedDocument);
              }} className="w-full sm:w-auto min-h-[44px]">
                Edit Document
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document Edit Modal */}
      <DocumentEditModal
        isOpen={showEditDocumentModal}
        onClose={() => {
          setShowEditDocumentModal(false);
          setDocumentToEdit(null);
        }}
        document={documentToEdit}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDocumentToDelete(null);
        }}
        title="Delete Document"
        maxWidth="md"
      >
        {documentToDelete && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Are you sure you want to delete this document?
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This action cannot be undone. The document and all associated data will be permanently deleted.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Document to be deleted:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{documentToDelete.title}</p>
              {documentToDelete.citation && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{documentToDelete.citation}</p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end space-y-reverse space-y-3 sm:space-y-0 sm:space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDocumentToDelete(null);
                }}
                disabled={deleting}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteDocument}
                loading={deleting}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Delete Document
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          // Refresh documents list after upload
          loadDocuments();
        }}
      />
    </div>
  );
}