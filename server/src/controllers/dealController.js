const dealService = require('../services/dealService');
const ApiResponse = require('../utils/apiResponse');

const list = async (req, res, next) => {
  try {
    const { stage, hygieneStatus, search, page, limit } = req.query;
    const result = await dealService.listDeals({
      organizationId: req.organizationId,
      stage,
      hygieneStatus,
      search,
      page,
      limit,
    });
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await dealService.getDealById(req.organizationId, req.params.id);
    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

const getIntelligence = async (req, res, next) => {
  try {
    const result = await dealService.getDealIntelligence(req.organizationId, req.params.id);
    return ApiResponse.success(res, result, 'Deal intelligence loaded successfully.');
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const deal = await dealService.createDeal({
      organizationId: req.organizationId,
      ownerId: req.user._id,
      data: req.body,
      userEmail: req.user.email,
    });
    return ApiResponse.created(res, deal, 'Deal opportunity created with hygiene tracking.');
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const deal = await dealService.updateDeal({
      organizationId: req.organizationId,
      dealId: req.params.id,
      data: req.body,
      userId: req.user._id,
      userEmail: req.user.email,
    });
    return ApiResponse.success(res, deal, 'Deal updated and hygiene score re-calculated.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  getById,
  getIntelligence,
  create,
  update,
};
