import type { TranslationShape } from './en';

/**
 * Vietnamese UI text (US-015). Same keys as `en.ts`; `satisfies` rejects missing and extra keys.
 * Glossary: dashboard = "bảng điều khiển", inventory/stock = "tồn kho", Aging = "Tồn kho lâu",
 * dealership = "đại lý", action = "hành động", vehicle = "xe".
 */
export const vi = {
  app: {
    title: 'Bảng điều khiển tồn kho',
    documentTitle: '{{page}} · Bảng điều khiển tồn kho',
  },
  layout: {
    brand: 'Bảng điều khiển tồn kho',
    skipToContent: 'Chuyển đến nội dung chính',
    mainNav: 'Điều hướng chính',
    copyright: '© {{year}}',
  },
  language: {
    label: 'Ngôn ngữ',
  },
  common: {
    loading: 'Đang tải…',
    retry: 'Thử lại',
    backHome: 'Về trang chủ',
  },
  errors: {
    boundary: {
      title: 'Đã xảy ra lỗi',
      message: 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.',
      retry: 'Thử lại',
    },
    route: {
      title: 'Rất tiếc',
      status: 'Lỗi {{status}} ({{statusText}})',
      generic: 'Đã xảy ra lỗi khi tải trang này.',
    },
    notFound: {
      title: 'Không tìm thấy trang',
    },
    state: {
      defaultTitle: 'Không thể tải dữ liệu',
    },
    messages: {
      vehicleNotAging: 'Chỉ có thể ghi nhận hành động cho xe tồn kho trên 90 ngày.',
      validation: 'Một số trường không hợp lệ.',
      notFound: 'Không tìm thấy nội dung bạn cần. Có thể nội dung này đã bị xóa.',
      network: 'Không thể kết nối với máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
      server: 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau giây lát.',
      unknown: 'Đã xảy ra lỗi. Vui lòng thử lại.',
    },
  },
  dealerships: {
    loadingOne: 'Đang tải đại lý…',
    loadingList: 'Đang tải danh sách đại lý…',
    loadErrorOne: 'Không thể tải đại lý',
    loadErrorList: 'Không thể tải danh sách đại lý',
    notFound: {
      title: 'Không tìm thấy đại lý',
      description: 'Đại lý này không tồn tại hoặc không còn hoạt động.',
      link: 'Đến bảng điều khiển',
    },
    empty: {
      title: 'Chưa có đại lý nào',
      description: 'Thêm một đại lý để bắt đầu theo dõi tồn kho.',
    },
  },
  inventory: {
    agingBadge: 'Tồn kho lâu',
    list: {
      loading: 'Đang tải danh sách xe…',
      loadError: 'Không thể tải danh sách xe',
      updating: 'Đang cập nhật…',
      refreshFailed: 'Không thể làm mới danh sách. Đang hiển thị dữ liệu tải gần nhất.',
      empty: {
        title: 'Không có xe tồn kho',
        description: '{{dealership}} hiện không có xe nào trong kho.',
      },
    },
    table: {
      caption: 'Xe tồn kho tại {{dealership}}',
      notAging: 'Chưa tồn kho lâu',
      noAction: 'Chưa có hành động',
      actionMeta: '{{loggedBy}} · {{loggedAt}}',
      header: {
        stockNumber: 'Mã tồn kho',
        make: 'Hãng xe',
        model: 'Mẫu xe',
        year: 'Đời xe',
        daysInStock: 'Số ngày tồn kho',
        aging: 'Tồn kho lâu',
        currentAction: 'Hành động hiện tại',
        listPrice: 'Giá niêm yết',
        stockInDate: 'Ngày nhập kho',
        mileage: 'Số dặm đã đi',
        trim: 'Phiên bản',
        colour: 'Màu sắc',
        vin: 'Số VIN',
      },
    },
    pagination: {
      label: 'Phân trang',
      summary: 'Hiển thị {{from}}-{{to}} / {{total}}',
      page: 'Trang {{page}} / {{lastPage}}',
      previous: 'Trước',
      previousLabel: 'Trang trước',
      next: 'Sau',
      nextLabel: 'Trang sau',
    },
  },
  actionStatus: {
    'Price Reduction Planned': 'Dự kiến giảm giá',
    'Marketing Promotion': 'Chạy khuyến mãi',
    'Transfer to Another Dealership': 'Chuyển sang đại lý khác',
    'Send to Auction/Wholesale': 'Đưa đi đấu giá/bán sỉ',
    'Under Review': 'Đang xem xét',
  },
} as const satisfies TranslationShape;
