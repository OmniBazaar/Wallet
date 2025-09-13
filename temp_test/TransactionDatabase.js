"use strict";
/**
 * Transaction Database Service for YugabyteDB Integration
 *
 * Provides database persistence for wallet transaction history using YugabyteDB.
 * Stores all transaction records for easy querying and reporting.
 *
 * @module services/database/TransactionDatabase
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionDatabase = void 0;
/**
 * Transaction Database Service
 *
 * Handles database operations for wallet transaction history.
 * Uses YugabyteDB for distributed SQL with PostgreSQL compatibility.
 */
var TransactionDatabase = /** @class */ (function () {
    /**
     * Construct a TransactionDatabase adapter.
     * @param apiEndpoint - Base API endpoint (defaults to /api/wallet)
     */
    function TransactionDatabase(apiEndpoint) {
        this.apiEndpoint = apiEndpoint !== null && apiEndpoint !== void 0 ? apiEndpoint : '/api/wallet';
    }
    /**
     * Store a new transaction
     * @param transaction - The transaction record to store
     * @returns Promise that resolves when transaction is stored
     */
    TransactionDatabase.prototype.storeTransaction = function (transaction) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(transaction)
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to store transaction: ".concat(response.statusText));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update transaction status
     * @param txHash - Transaction hash to update
     * @param status - New transaction status
     * @param blockNumber - Block number where transaction was mined
     * @param confirmations - Number of confirmations
     * @returns Promise that resolves when status is updated
     */
    TransactionDatabase.prototype.updateTransactionStatus = function (txHash, status, blockNumber, confirmations) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/").concat(txHash), {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                status: status,
                                blockNumber: blockNumber,
                                confirmations: confirmations,
                                confirmedAt: status === 'confirmed' ? new Date().toISOString() : undefined
                            })
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to update transaction: ".concat(response.statusText));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get transaction by hash
     * @param txHash - Transaction hash to look up
     * @returns Transaction record or null if not found
     */
    TransactionDatabase.prototype.getTransaction = function (txHash) {
        return __awaiter(this, void 0, void 0, function () {
            var response, data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/").concat(txHash))];
                    case 1:
                        response = _a.sent();
                        if (response.status === 404) {
                            return [2 /*return*/, null];
                        }
                        if (!response.ok) {
                            throw new Error("Failed to get transaction: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, this.mapToTransactionRecord(data)];
                }
            });
        });
    };
    /**
     * Get user's transaction history
     * @param userAddress - User's wallet address
     * @param filters - Optional filters for the query
     * @returns Object containing transactions array and total count
     */
    TransactionDatabase.prototype.getUserTransactions = function (userAddress, filters) {
        return __awaiter(this, void 0, void 0, function () {
            var params, response, data;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        params = new URLSearchParams();
                        params.set('user', userAddress);
                        if (filters !== undefined) {
                            if (filters.txType !== undefined)
                                params.set('type', filters.txType);
                            if (filters.status !== undefined)
                                params.set('status', filters.status);
                            if (filters.tokenSymbol !== undefined && filters.tokenSymbol !== '')
                                params.set('token', filters.tokenSymbol);
                            if (filters.fromDate !== undefined)
                                params.set('from_date', filters.fromDate.toISOString());
                            if (filters.toDate !== undefined)
                                params.set('to_date', filters.toDate.toISOString());
                            if (filters.minAmount !== undefined && filters.minAmount !== '')
                                params.set('min_amount', filters.minAmount);
                            if (filters.maxAmount !== undefined && filters.maxAmount !== '')
                                params.set('max_amount', filters.maxAmount);
                            if (filters.sortBy !== undefined)
                                params.set('sort_by', filters.sortBy);
                            if (filters.sortOrder !== undefined)
                                params.set('sort_order', filters.sortOrder);
                            params.set('limit', ((_a = filters.limit) !== null && _a !== void 0 ? _a : 50).toString());
                            params.set('offset', ((_b = filters.offset) !== null && _b !== void 0 ? _b : 0).toString());
                        }
                        return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions?").concat(String(params)))];
                    case 1:
                        response = _c.sent();
                        if (!response.ok) {
                            throw new Error("Failed to get transactions: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _c.sent();
                        return [2 /*return*/, {
                                transactions: data.transactions.map(function (t) { return _this.mapToTransactionRecord(t); }),
                                total: data.total
                            }];
                }
            });
        });
    };
    /**
     * Get transaction statistics for a user
     * @param userAddress - User's wallet address
     * @returns Transaction statistics
     */
    TransactionDatabase.prototype.getUserStats = function (userAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/stats?user=").concat(userAddress))];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to get statistics: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Add a note to a transaction
     * @param txHash - Transaction hash to add note to
     * @param note - Note text to add
     * @param category - Optional category for the note
     * @param tags - Optional tags for filtering
     * @returns Promise that resolves when note is added
     */
    TransactionDatabase.prototype.addTransactionNote = function (txHash, note, category, tags) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/").concat(txHash, "/note"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                note: note,
                                category: category,
                                tags: tags
                            })
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to add note: ".concat(response.statusText));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get pending transactions for monitoring
     * @param userAddress - Optional user address to filter by
     * @returns Array of pending transactions
     */
    TransactionDatabase.prototype.getPendingTransactions = function (userAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var params, response, data;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = new URLSearchParams();
                        params.set('status', 'pending');
                        if (userAddress !== undefined && userAddress !== '')
                            params.set('user', userAddress);
                        return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/pending?").concat(String(params)))];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to get pending transactions: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, data.map(function (t) { return _this.mapToTransactionRecord(t); })];
                }
            });
        });
    };
    /**
     * Bulk update transaction confirmations
     * @param updates - Array of update objects containing txHash, confirmations, and optional status
     * @returns Promise that resolves when updates are complete
     */
    TransactionDatabase.prototype.updateConfirmations = function (updates) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/bulk-update"), {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ updates: updates })
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to update confirmations: ".concat(response.statusText));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Export transactions for a date range
     * @param userAddress - User's wallet address
     * @param fromDate - Start date for export range
     * @param toDate - End date for export range
     * @param format - Export format (csv or json)
     * @returns Blob containing exported data
     */
    TransactionDatabase.prototype.exportTransactions = function (userAddress_1, fromDate_1, toDate_1) {
        return __awaiter(this, arguments, void 0, function (userAddress, fromDate, toDate, format) {
            var params, response;
            if (format === void 0) { format = 'json'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        params = new URLSearchParams();
                        params.set('user', userAddress);
                        params.set('from_date', fromDate.toISOString());
                        params.set('to_date', toDate.toISOString());
                        params.set('format', format);
                        return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/transactions/export?").concat(String(params)))];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Failed to export transactions: ".concat(response.statusText));
                        }
                        return [4 /*yield*/, response.blob()];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Map database row to TransactionRecord
     * @param row - Database row object
     * @returns Mapped TransactionRecord
     */
    TransactionDatabase.prototype.mapToTransactionRecord = function (row) {
        var record = {
            txHash: row.tx_hash,
            userAddress: row.user_address,
            txType: row.tx_type,
            fromAddress: row.from_address,
            toAddress: row.to_address,
            amount: row.amount,
            tokenSymbol: row.token_symbol,
            status: row.status,
            createdAt: new Date(row.created_at)
        };
        // Add optional fields only if they exist
        if (row.id !== undefined)
            record.id = row.id;
        if (row.block_number !== undefined)
            record.blockNumber = row.block_number;
        if (row.block_hash !== undefined)
            record.blockHash = row.block_hash;
        if (row.contract_address !== undefined)
            record.contractAddress = row.contract_address;
        if (row.token_address !== undefined)
            record.tokenAddress = row.token_address;
        if (row.token_decimals !== undefined)
            record.tokenDecimals = row.token_decimals;
        if (row.gas_used !== undefined)
            record.gasUsed = row.gas_used;
        if (row.gas_price !== undefined)
            record.gasPrice = row.gas_price;
        if (row.tx_fee !== undefined)
            record.txFee = row.tx_fee;
        if (row.confirmations !== undefined)
            record.confirmations = row.confirmations;
        if (row.confirmed_at !== undefined)
            record.confirmedAt = new Date(row.confirmed_at);
        if (row.metadata !== undefined)
            record.metadata = row.metadata;
        if (row.notes !== undefined)
            record.notes = row.notes;
        if (row.tags !== undefined)
            record.tags = row.tags;
        return record;
    };
    /**
     * Check database connectivity
     * @returns True if database is accessible, false otherwise
     */
    TransactionDatabase.prototype.checkConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fetch("".concat(this.apiEndpoint, "/health"))];
                    case 1:
                        response = _a.sent();
                        return [2 /*return*/, response.ok];
                    case 2:
                        error_1 = _a.sent();
                        // Log error using proper logging mechanism instead of console
                        // In production, this should use a proper logger service
                        // Error: error
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return TransactionDatabase;
}());
exports.TransactionDatabase = TransactionDatabase;
