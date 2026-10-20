import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NatureReservesRepository } from './nature-reserves.repository';
import { NatureReservesService } from './nature-reserves.service';

describe('NatureReservesService', () => {
  const repository = {
    list: jest.fn(),
    count: jest.fn(),
    mapLayer: jest.fn(),
    filterOptions: jest.fn(),
    summary: jest.fn(),
    findById: jest.fn(),
    documents: jest.fn(),
  };
  let service: NatureReservesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NatureReservesService(repository as unknown as NatureReservesRepository);
  });

  it('normalizes filters and caps the page size', async () => {
    repository.list.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    const result = await service.list({
      q: '  Cát Tiên  ',
      yearFrom: '2000',
      yearTo: '2020',
      sort: 'year-desc',
      page: '2',
      limit: '500',
    });

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Cát Tiên', yearFrom: 2000, yearTo: 2020 }),
      'year-desc',
      100,
      100,
    );
    expect(result).toMatchObject({ page: 2, limit: 100, totalPages: 1 });
  });

  it('rejects an unsupported sort option', async () => {
    await expect(service.list({ sort: 'DROP TABLE nature_reserves' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reversed numeric ranges', async () => {
    await expect(service.list({ areaMin: '200', areaMax: '100' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list({ yearFrom: '2020', yearTo: '2000' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a not-found response for an unknown reserve', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.detail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
